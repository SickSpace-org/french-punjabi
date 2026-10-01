-- French Punjabi — Teacher Portal, Phase 4a: teacher-editable meeting link
-- + class recording links, with a tamper-resistant admin audit trail. Run
-- after 035_teacher_attendance_access.sql.
--
-- Design, spelled out (confirmed with the user before writing this):
--  - No soft-delete anywhere in this schema today — the one existing
--    "admin needs full history" precedent is batch_change_history (028): a
--    separate, permanent, append-only log table, written by application
--    code alongside the real mutation, while the row being changed is
--    updated/deleted normally. This migration matches that pattern:
--    class_recordings stays "current state only" (real UPDATE on edit,
--    real DELETE on delete), and teacher_content_audit is the permanent
--    history log.
--  - The audit trail is a record-keeping requirement, not just a
--    recover-if-needed safety net — so a teacher session must have no way
--    to deliberately skip or forge it. Teachers get NO direct table grant
--    on class_recordings or teacher_content_audit at all (see grants at
--    the bottom); every mutation goes through a SECURITY DEFINER RPC
--    (teacher_add_recording / teacher_update_recording /
--    teacher_delete_recording) that performs the real write AND the audit
--    row in the same function call.
--  - Same best-effort tradeoff as batch_change_history (028) on the audit
--    write specifically, by explicit user decision: if the audit insert
--    itself fails (a genuine DB-level fault, not something a client can
--    trigger on purpose), the real create/update/delete still succeeds —
--    it just isn't logged that one time. The audit insert in each RPC
--    below is wrapped in its own exception handler that RAISE WARNINGs
--    (Postgres's server-side log, the SQL equivalent of this codebase's
--    console.error) rather than rolling back the caller's real mutation.
--  - teacher_content_audit.content_id is deliberately NOT a foreign key —
--    the live class_recordings row it refers to may since have been
--    deleted, and the whole point is that the audit row survives that.

-- =========================================================
-- student_owns_current_batch() — the student-side mirror of
-- batch_owned_by_current_teacher() (033). plpgsql (not sql) from the
-- start — see 033_fix_teacher_rls_recursion.sql for why that matters when
-- a security-definer function is used inside another table's RLS policy.
-- =========================================================

create or replace function public.student_owns_current_batch(p_batch_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.students s
    where s.auth_user_id = auth.uid()
      and s.status = 'ACTIVE'
      and public.student_current_batch_id(s.id) = p_batch_id
  );
end;
$$;

grant execute on function public.student_owns_current_batch(uuid) to authenticated;

-- =========================================================
-- Tables
-- =========================================================

create table public.class_recordings (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  teacher_name_snapshot text not null,
  class_date date,
  url text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index class_recordings_batch_id_idx on public.class_recordings (batch_id);

drop trigger if exists set_updated_at on public.class_recordings;
create trigger set_updated_at before update on public.class_recordings
  for each row execute function public.set_updated_at();

-- Permanent history log — see the big comment at the top of this file.
create table public.teacher_content_audit (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('recording', 'material')),
  content_id uuid not null,
  batch_id uuid not null references public.batches (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  teacher_name_snapshot text not null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  -- Snapshot of the relevant fields AT THE TIME of this event, so admin can
  -- see exactly what was added/changed/removed even after the live row is
  -- gone. Only 'recording' fields are populated by this migration (034);
  -- storage_path is reserved for 'material' events in a later migration
  -- (Phase 4b).
  title text,
  url text,
  storage_path text,
  class_date date,
  created_at timestamptz not null default now()
);

create index teacher_content_audit_batch_id_idx on public.teacher_content_audit (batch_id);
create index teacher_content_audit_teacher_id_idx on public.teacher_content_audit (teacher_id);
create index teacher_content_audit_content_id_idx on public.teacher_content_audit (content_id);

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.class_recordings enable row level security;
alter table public.teacher_content_audit enable row level security;

drop policy if exists "class_recordings_admin_write" on public.class_recordings;
create policy "class_recordings_admin_write" on public.class_recordings
  for all using (public.is_admin()) with check (public.is_admin());

-- Teachers/students may READ their own batch's recordings directly — but
-- there is deliberately no matching insert/update/delete policy for
-- either role. All writes go through the RPCs below, which run as the
-- function owner (exempt from RLS on its own tables), not as the caller.
drop policy if exists "class_recordings_teacher_select" on public.class_recordings;
create policy "class_recordings_teacher_select" on public.class_recordings
  for select using (public.batch_owned_by_current_teacher(batch_id));

drop policy if exists "class_recordings_student_select" on public.class_recordings;
create policy "class_recordings_student_select" on public.class_recordings
  for select using (public.student_owns_current_batch(batch_id));

-- teacher_content_audit — admin-only, full stop. Same "no self-select
-- policy at all" reasoning as teacher_payments/teacher_hours
-- (031_teachers.sql): unreachable by a teacher's own session even via a
-- direct query, not just hidden in the UI.
drop policy if exists "teacher_content_audit_admin_select" on public.teacher_content_audit;
create policy "teacher_content_audit_admin_select" on public.teacher_content_audit
  for select using (public.is_admin());

-- =========================================================
-- teacher_update_meeting_link() — lets a teacher change ONLY their own
-- batch's meeting_link, never any other column on that row (pricing/slots/
-- display_order stay admin-only) — narrow RPC instead of a wide RLS
-- UPDATE grant on batches, same principle as mark_class_attendance().
-- =========================================================

create or replace function public.teacher_update_meeting_link(p_batch_id uuid, p_meeting_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.batch_owned_by_current_teacher(p_batch_id) then
    raise exception 'not authorized for this batch';
  end if;

  update public.batches set meeting_link = p_meeting_link where id = p_batch_id;
end;
$$;

grant execute on function public.teacher_update_meeting_link(uuid, text) to authenticated;

-- =========================================================
-- teacher_add_recording() / teacher_update_recording() /
-- teacher_delete_recording() — the ONLY way a teacher's session can ever
-- write to class_recordings. Each performs its real mutation and the
-- matching teacher_content_audit row in the same function call.
-- =========================================================

create or replace function public.teacher_add_recording(
  p_batch_id uuid, p_url text, p_title text, p_class_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_id uuid;
begin
  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(p_batch_id) then
    raise exception 'not authorized for this batch';
  end if;
  if p_url is null or length(trim(p_url)) = 0 then
    raise exception 'url is required';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;
  v_id := gen_random_uuid();

  insert into public.class_recordings (id, batch_id, teacher_id, teacher_name_snapshot, url, title, class_date)
  values (v_id, p_batch_id, v_teacher_id, v_teacher_name, trim(p_url), nullif(trim(p_title), ''), p_class_date);

  -- Best-effort, same tradeoff as batch_change_history (028): a failure
  -- here must never undo the create above, which has already succeeded.
  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, url, class_date)
    values
      ('recording', v_id, p_batch_id, v_teacher_id, v_teacher_name, 'created', nullif(trim(p_title), ''), trim(p_url), p_class_date);
  exception when others then
    raise warning 'teacher_content_audit insert failed (create, recording %): %', v_id, sqlerrm;
  end;

  return v_id;
end;
$$;

grant execute on function public.teacher_add_recording(uuid, text, text, date) to authenticated;

create or replace function public.teacher_update_recording(
  p_recording_id uuid, p_url text, p_title text, p_class_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_batch_id uuid;
begin
  select batch_id into v_batch_id from public.class_recordings where id = p_recording_id;
  if v_batch_id is null then
    raise exception 'recording not found';
  end if;

  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(v_batch_id) then
    raise exception 'not authorized for this batch';
  end if;
  if p_url is null or length(trim(p_url)) = 0 then
    raise exception 'url is required';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;

  update public.class_recordings
  set url = trim(p_url), title = nullif(trim(p_title), ''), class_date = p_class_date
  where id = p_recording_id;

  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, url, class_date)
    values
      ('recording', p_recording_id, v_batch_id, v_teacher_id, v_teacher_name, 'updated', nullif(trim(p_title), ''), trim(p_url), p_class_date);
  exception when others then
    raise warning 'teacher_content_audit insert failed (update, recording %): %', p_recording_id, sqlerrm;
  end;
end;
$$;

grant execute on function public.teacher_update_recording(uuid, text, text, date) to authenticated;

create or replace function public.teacher_delete_recording(p_recording_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_batch_id uuid;
  v_title text;
  v_url text;
  v_class_date date;
begin
  select batch_id, title, url, class_date into v_batch_id, v_title, v_url, v_class_date
  from public.class_recordings where id = p_recording_id;
  if v_batch_id is null then
    raise exception 'recording not found';
  end if;

  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(v_batch_id) then
    raise exception 'not authorized for this batch';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;

  delete from public.class_recordings where id = p_recording_id;

  -- Snapshot captured BEFORE the delete above — this is what lets admin
  -- see what a deleted recording actually was, not just that one existed.
  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, url, class_date)
    values
      ('recording', p_recording_id, v_batch_id, v_teacher_id, v_teacher_name, 'deleted', v_title, v_url, v_class_date);
  exception when others then
    raise warning 'teacher_content_audit insert failed (delete, recording %): %', p_recording_id, sqlerrm;
  end;
end;
$$;

grant execute on function public.teacher_delete_recording(uuid) to authenticated;

-- =========================================================
-- Grants — RLS restricts *which rows*; these grant the underlying verbs.
-- class_recordings gets the standard full grant (matches every other
-- admin-managed table here) — safe because no non-admin INSERT/UPDATE/
-- DELETE policy exists, so a teacher session still can't write to it
-- directly even with the verb granted; only the RPCs above (running as
-- the function owner) can. teacher_content_audit deliberately gets ONLY
-- select — nothing except the RPCs (as owner) can ever write to it, not
-- even an admin's own direct insert.
-- =========================================================

grant select, insert, update, delete on public.class_recordings to authenticated;
grant select on public.teacher_content_audit to authenticated;
