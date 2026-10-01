-- French Punjabi — Teacher Portal, Phase 5: teacher-to-student messaging
-- (individual or whole-batch), reusing everything from 4a/4b rather than
-- duplicating it. Run after 037_batch_materials.sql.
--
-- NEW TABLE, not an extension of student_notifications — checked directly
-- before deciding (not assumed): student_notifications.lesson_id is `not
-- null`, and everything built on top of it hard-assumes a lesson is
-- always present — StudentNotification's TS type requires lessonId/
-- lessonTitle/courseId as non-optional, and NotificationRow.tsx
-- unconditionally renders a "View Reply" link to a lesson. Making those
-- fields nullable and branching that component is genuinely more
-- surface area, and more regression risk to an already-working feature,
-- than a clean second table. The student-facing inbox is still reused —
-- see src/lib/student/getNotifications.ts, which merges both tables into
-- one list — this migration only changes the DATA layer, not the UI.
--
-- Permanence, by explicit user decision: sent messages can never be
-- edited or recalled in this phase — teacher_send_message() is the only
-- write path and there is no corresponding update/delete RPC. This is a
-- deliberate limitation, not an oversight (flagged again in the
-- completion report).

-- =========================================================
-- teacher_content_audit (034) gains a 'message' content_type and a body
-- column — recordings/materials fit (title + url/storage_path) doesn't
-- cover a message's actual text, checked directly before adding this
-- rather than repurposing an existing column for something it doesn't
-- mean. Nullable — only 'message' events ever populate it.
-- =========================================================

alter table public.teacher_content_audit drop constraint if exists teacher_content_audit_content_type_check;
alter table public.teacher_content_audit add constraint teacher_content_audit_content_type_check
  check (content_type in ('recording', 'material', 'message'));

alter table public.teacher_content_audit add column if not exists body text;

-- =========================================================
-- is_own_student_id() — the student-side equivalent of
-- batch_owned_by_current_teacher()/student_owns_current_batch(): "is this
-- row addressed to ME." plpgsql from the start, same reasoning as every
-- function since 033_fix_teacher_rls_recursion.sql.
-- =========================================================

create or replace function public.is_own_student_id(p_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.students
    where id = p_student_id and auth_user_id = auth.uid()
  );
end;
$$;

grant execute on function public.is_own_student_id(uuid) to authenticated;

-- =========================================================
-- Table — one row per RECIPIENT (same per-recipient-row shape
-- student_notifications already uses, which is why the student-side
-- query/merge in getNotifications.ts stays simple). A whole-batch
-- announcement fans out to N rows at send time, all sharing one
-- broadcast_id — that's what lets the teacher's "sent messages" list and
-- the audit log each show ONE entry per compose action instead of N
-- near-duplicates.
-- =========================================================

create table public.teacher_messages (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  teacher_name_snapshot text not null,
  student_id uuid not null references public.students (id) on delete cascade,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index teacher_messages_student_id_idx on public.teacher_messages (student_id);
create index teacher_messages_batch_id_idx on public.teacher_messages (batch_id);
create index teacher_messages_broadcast_id_idx on public.teacher_messages (broadcast_id);

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.teacher_messages enable row level security;

drop policy if exists "teacher_messages_admin_write" on public.teacher_messages;
create policy "teacher_messages_admin_write" on public.teacher_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- Teacher: read-only on their own sent messages (powers the "sent
-- messages" list) — no insert/update/delete policy. All writes go
-- through teacher_send_message() below.
drop policy if exists "teacher_messages_teacher_select" on public.teacher_messages;
create policy "teacher_messages_teacher_select" on public.teacher_messages
  for select using (public.batch_owned_by_current_teacher(batch_id));

drop policy if exists "teacher_messages_student_select" on public.teacher_messages;
create policy "teacher_messages_student_select" on public.teacher_messages
  for select using (public.is_own_student_id(student_id));

-- Same "self can mark read, nothing else" shape as
-- notifications_self_update (008_progress_comments_notifications.sql) —
-- app code only ever sends {is_read: true}, mirroring that existing
-- precedent rather than inventing a column-level restriction that
-- doesn't exist anywhere else in this schema either.
drop policy if exists "teacher_messages_student_update" on public.teacher_messages;
create policy "teacher_messages_student_update" on public.teacher_messages
  for update using (public.is_own_student_id(student_id)) with check (public.is_own_student_id(student_id));

grant select, insert, update, delete on public.teacher_messages to authenticated;

-- =========================================================
-- teacher_send_message() — the ONLY way a teacher's session can ever
-- write to teacher_messages. p_student_id = null means "send to every
-- student currently in this batch" (reuses teacher_batch_roster()'s
-- already-proven roster resolution rather than re-deriving "who's
-- currently in this batch"); a non-null p_student_id is independently
-- verified to actually be in that roster — owning the batch alone is not
-- enough to message an arbitrary student_id.
-- =========================================================

create or replace function public.teacher_send_message(
  p_batch_id uuid, p_student_id uuid, p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_broadcast_id uuid;
  v_recipient_summary text;
  v_recipient_count int := 0;
  r record;
begin
  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(p_batch_id) then
    raise exception 'not authorized for this batch';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'message body is required';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;
  v_broadcast_id := gen_random_uuid();

  if p_student_id is not null then
    select full_name into v_recipient_summary
    from public.teacher_batch_roster(p_batch_id) where student_id = p_student_id;

    if v_recipient_summary is null then
      raise exception 'student is not currently in this batch';
    end if;

    insert into public.teacher_messages (broadcast_id, batch_id, teacher_id, teacher_name_snapshot, student_id, body)
    values (v_broadcast_id, p_batch_id, v_teacher_id, v_teacher_name, p_student_id, trim(p_body));

    v_recipient_count := 1;
    v_recipient_summary := 'Individual: ' || v_recipient_summary;
  else
    for r in select student_id from public.teacher_batch_roster(p_batch_id) loop
      insert into public.teacher_messages (broadcast_id, batch_id, teacher_id, teacher_name_snapshot, student_id, body)
      values (v_broadcast_id, p_batch_id, v_teacher_id, v_teacher_name, r.student_id, trim(p_body));
      v_recipient_count := v_recipient_count + 1;
    end loop;

    if v_recipient_count = 0 then
      raise exception 'no students currently in this batch to message';
    end if;

    v_recipient_summary := 'Batch announcement (' || v_recipient_count || ' student'
      || case when v_recipient_count = 1 then '' else 's' end || ')';
  end if;

  -- Best-effort, same tradeoff as batch_change_history (028) and every
  -- audit insert since 034: a failure here must never undo the send
  -- above, which has already succeeded for its recipient(s).
  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, body)
    values
      ('message', v_broadcast_id, p_batch_id, v_teacher_id, v_teacher_name, 'created', v_recipient_summary, trim(p_body));
  exception when others then
    raise warning 'teacher_content_audit insert failed (message, broadcast %): %', v_broadcast_id, sqlerrm;
  end;

  return v_broadcast_id;
end;
$$;

grant execute on function public.teacher_send_message(uuid, uuid, text) to authenticated;
