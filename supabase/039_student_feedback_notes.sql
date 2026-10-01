-- French Punjabi — Teacher Portal, Phase 6: private feedback notes with a
-- single student reply. Run after 038_teacher_messages.sql.
--
-- Confirmed design decisions (AskUserQuestion, all defaults accepted):
--  1. Scope: GENERAL — a note is about a student, not tied to any lesson.
--     No lesson_id at all (contrast with lesson_comments, which is
--     lesson-scoped).
--  2. Thread start: TEACHER ONLY. A student can reply to a note addressed
--     to them, but can never start a new thread — enforced by the RLS
--     student_insert policy below (parent_note_id is not null), not just
--     hidden in the UI.
--  3. Audit: the teacher's own note only (create/update/delete) is logged
--     to teacher_content_audit, exactly like recordings/materials/messages.
--     A student's reply is NOT audited — it isn't "teacher content."
--  4. Edit/delete: the teacher's root note is editable/deletable, each
--     change audited — same shape as recordings/materials (034/035), NOT
--     the permanent-forever shape used for messages (036). A student's
--     reply, once posted, has no edit/delete path at all (not asked for;
--     kept simple and consistent with "only the teacher's note is
--     audited" — an editable reply would need its own audit story this
--     phase deliberately doesn't build).
--
-- Privacy model, checked directly rather than assumed: this is NOT
-- lesson_comments' shared-per-lesson "one room" model (any student with
-- course access sees the whole thread). A feedback note is private
-- between exactly one student and their teacher (plus admin) — closer to
-- teacher_messages' per-recipient privacy. The one-level-nesting TRIGGER
-- pattern is mirrored from lesson_comments (enforce_comment_nesting);
-- the RLS visibility model is not.
--
-- Ownership consistency, by design: like class_recordings/batch_materials/
-- teacher_messages before it, batch_id is FROZEN on the row at creation
-- time and ownership is always re-derived from that frozen batch_id
-- (batch_owned_by_current_teacher), never from "is this currently my
-- student." A student who later moves to a different teacher's batch
-- still has their old notes visible only to whichever teacher currently
-- owns that old batch_id — the exact same precedent already established
-- for every other teacher-authored content type, not a new special case.

-- =========================================================
-- teacher_content_audit (034/036) gains a 'feedback_note' content_type —
-- no other schema change needed: body already exists (036), title is
-- reused to hold "For {student full name}" the same way messages reuse
-- it for a recipient summary.
-- =========================================================

alter table public.teacher_content_audit drop constraint if exists teacher_content_audit_content_type_check;
alter table public.teacher_content_audit add constraint teacher_content_audit_content_type_check
  check (content_type in ('recording', 'material', 'message', 'feedback_note'));

-- =========================================================
-- Table — one row per note OR reply. A root note has parent_note_id null
-- and is teacher-authored (teacher_id/teacher_name_snapshot set by the
-- RPC). A reply has parent_note_id set and is student-authored — its
-- batch_id/teacher_id/teacher_name_snapshot/student_id are NOT trusted
-- from the client; the trigger below derives all four from the parent
-- row, so a reply is structurally impossible to detach from its thread's
-- real teacher/batch/student context.
-- =========================================================

create table public.student_feedback_notes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  teacher_name_snapshot text not null,
  student_id uuid not null references public.students (id) on delete cascade,
  parent_note_id uuid references public.student_feedback_notes (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_feedback_notes_batch_id_idx on public.student_feedback_notes (batch_id);
create index student_feedback_notes_student_id_idx on public.student_feedback_notes (student_id);
create index student_feedback_notes_parent_id_idx on public.student_feedback_notes (parent_note_id);

drop trigger if exists set_updated_at on public.student_feedback_notes;
create trigger set_updated_at before update on public.student_feedback_notes
  for each row execute function public.set_updated_at();

-- =========================================================
-- enforce_feedback_note_reply() — mirrors enforce_comment_nesting()
-- (008_progress_comments_notifications.sql): one level of nesting only,
-- parent_note_id can never change after creation. Goes further than that
-- precedent because this table's RLS (batch_owned_by_current_teacher /
-- is_own_student_id) depends on batch_id/teacher_id/student_id being
-- correct on EVERY row, reply rows included — so for a reply, this
-- trigger overwrites those four columns from the parent regardless of
-- what the client sent, before RLS's own WITH CHECK evaluates the row
-- (Postgres evaluates WITH CHECK against the row as it stands AFTER
-- BEFORE-ROW triggers have run). This is deliberately not the only
-- layer: the RLS WITH CHECK below independently re-asserts
-- is_own_student_id(student_id) on that same, already-derived value —
-- two layers, neither trusting the other alone, same approach used
-- throughout this codebase (e.g. every teacher RPC re-checks batch
-- ownership itself rather than trusting the caller already passed
-- through RLS).
--
-- Deliberately NOT security definer: this function runs as the calling
-- role, so its own lookup of the parent row is itself subject to
-- student_select's RLS policy. That's a feature, not a limitation — a
-- student attempting to reply to a note that isn't visible to them (i.e.
-- not their own) simply can't find "the parent row" at all during this
-- lookup, so it fails closed with "parent note not found" before ever
-- reaching the ownership-specific error message.
-- =========================================================

create or replace function public.enforce_feedback_note_reply()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent record;
begin
  if tg_op = 'UPDATE' and new.parent_note_id is distinct from old.parent_note_id then
    raise exception 'parent_note_id cannot be changed after a note is created.';
  end if;

  if tg_op = 'INSERT' and new.parent_note_id is not null then
    select id, parent_note_id, batch_id, teacher_id, teacher_name_snapshot, student_id
    into v_parent
    from public.student_feedback_notes
    where id = new.parent_note_id;

    if v_parent.id is null then
      raise exception 'parent note not found';
    end if;
    if v_parent.parent_note_id is not null then
      raise exception 'Cannot reply to a reply — feedback notes support only one level of nesting.';
    end if;

    new.batch_id := v_parent.batch_id;
    new.teacher_id := v_parent.teacher_id;
    new.teacher_name_snapshot := v_parent.teacher_name_snapshot;
    new.student_id := v_parent.student_id;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_feedback_note_reply on public.student_feedback_notes;
create trigger enforce_feedback_note_reply before insert or update on public.student_feedback_notes
  for each row execute function public.enforce_feedback_note_reply();

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.student_feedback_notes enable row level security;

drop policy if exists "student_feedback_notes_admin_write" on public.student_feedback_notes;
create policy "student_feedback_notes_admin_write" on public.student_feedback_notes
  for all using (public.is_admin()) with check (public.is_admin());

-- Teacher: read-only, root notes AND replies for their own batch(es).
-- No insert/update/delete policy — a teacher's root note only ever goes
-- through the RPCs below, which run as the function owner and bypass RLS
-- for their own internal writes.
drop policy if exists "student_feedback_notes_teacher_select" on public.student_feedback_notes;
create policy "student_feedback_notes_teacher_select" on public.student_feedback_notes
  for select using (public.batch_owned_by_current_teacher(batch_id));

-- Student: read their own thread(s) — both the teacher's note and their
-- own reply, since both rows carry student_id = them (a reply's is
-- derived from the parent, never client-supplied).
drop policy if exists "student_feedback_notes_student_select" on public.student_feedback_notes;
create policy "student_feedback_notes_student_select" on public.student_feedback_notes
  for select using (public.is_own_student_id(student_id));

-- Student: may INSERT a reply only — never a root note (parent_note_id
-- is not null is required here), and only onto a thread that is about
-- them. is_own_student_id(student_id) evaluates the POST-TRIGGER value
-- (the parent's real student_id), not whatever the client sent, so this
-- cannot be satisfied by a student naming themselves while replying to
-- someone else's note — the trigger already overwrote student_id to the
-- parent's before this check runs.
drop policy if exists "student_feedback_notes_student_insert" on public.student_feedback_notes;
create policy "student_feedback_notes_student_insert" on public.student_feedback_notes
  for insert with check (
    parent_note_id is not null
    and public.is_own_student_id(student_id)
  );

grant select, insert, update, delete on public.student_feedback_notes to authenticated;

-- =========================================================
-- teacher_add_feedback_note() / teacher_update_feedback_note() /
-- teacher_delete_feedback_note() — the ONLY way a teacher's session can
-- ever write a root note. Mirrors teacher_add_recording() /
-- teacher_update_recording() / teacher_delete_recording() (034)
-- byte-for-byte in structure. Each performs its real mutation and the
-- matching teacher_content_audit row (best-effort, same
-- exception-wrapped tradeoff as every audit insert since 034) in the
-- same function call.
-- =========================================================

create or replace function public.teacher_add_feedback_note(
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
  v_student_name text;
  v_id uuid;
begin
  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(p_batch_id) then
    raise exception 'not authorized for this batch';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'note body is required';
  end if;

  select full_name into v_student_name
  from public.teacher_batch_roster(p_batch_id) where student_id = p_student_id;
  if v_student_name is null then
    raise exception 'student is not currently in this batch';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;
  v_id := gen_random_uuid();

  insert into public.student_feedback_notes (id, batch_id, teacher_id, teacher_name_snapshot, student_id, body)
  values (v_id, p_batch_id, v_teacher_id, v_teacher_name, p_student_id, trim(p_body));

  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, body)
    values
      ('feedback_note', v_id, p_batch_id, v_teacher_id, v_teacher_name, 'created', 'For ' || v_student_name, trim(p_body));
  exception when others then
    raise warning 'teacher_content_audit insert failed (create, feedback_note %): %', v_id, sqlerrm;
  end;

  return v_id;
end;
$$;

grant execute on function public.teacher_add_feedback_note(uuid, uuid, text) to authenticated;

create or replace function public.teacher_update_feedback_note(p_note_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_batch_id uuid;
  v_student_id uuid;
  v_parent_note_id uuid;
  v_student_name text;
begin
  select batch_id, student_id, parent_note_id into v_batch_id, v_student_id, v_parent_note_id
  from public.student_feedback_notes where id = p_note_id;
  if v_batch_id is null then
    raise exception 'note not found';
  end if;
  if v_parent_note_id is not null then
    raise exception 'can only edit a top-level note, not a reply';
  end if;

  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(v_batch_id) then
    raise exception 'not authorized for this batch';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'note body is required';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;
  select full_name into v_student_name
  from public.teacher_batch_roster(v_batch_id) where student_id = v_student_id;

  update public.student_feedback_notes set body = trim(p_body) where id = p_note_id;

  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, body)
    values
      ('feedback_note', p_note_id, v_batch_id, v_teacher_id, v_teacher_name, 'updated', 'For ' || coalesce(v_student_name, '(former student)'), trim(p_body));
  exception when others then
    raise warning 'teacher_content_audit insert failed (update, feedback_note %): %', p_note_id, sqlerrm;
  end;
end;
$$;

grant execute on function public.teacher_update_feedback_note(uuid, text) to authenticated;

create or replace function public.teacher_delete_feedback_note(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_teacher_name text;
  v_batch_id uuid;
  v_student_id uuid;
  v_parent_note_id uuid;
  v_body text;
  v_student_name text;
begin
  select batch_id, student_id, parent_note_id, body into v_batch_id, v_student_id, v_parent_note_id, v_body
  from public.student_feedback_notes where id = p_note_id;
  if v_batch_id is null then
    raise exception 'note not found';
  end if;
  if v_parent_note_id is not null then
    raise exception 'can only delete a top-level note, not a reply';
  end if;

  v_teacher_id := public.current_teacher_id();
  if v_teacher_id is null or not public.batch_owned_by_current_teacher(v_batch_id) then
    raise exception 'not authorized for this batch';
  end if;

  select full_name into v_teacher_name from public.teachers where id = v_teacher_id;
  select full_name into v_student_name
  from public.teacher_batch_roster(v_batch_id) where student_id = v_student_id;

  -- Cascades: parent_note_id is ON DELETE CASCADE, so any student reply
  -- on this thread is deleted along with it. That reply was never
  -- audited in the first place (see the design note at the top of this
  -- file), so there is nothing further to log here.
  delete from public.student_feedback_notes where id = p_note_id;

  begin
    insert into public.teacher_content_audit
      (content_type, content_id, batch_id, teacher_id, teacher_name_snapshot, action, title, body)
    values
      ('feedback_note', p_note_id, v_batch_id, v_teacher_id, v_teacher_name, 'deleted', 'For ' || coalesce(v_student_name, '(former student)'), v_body);
  exception when others then
    raise warning 'teacher_content_audit insert failed (delete, feedback_note %): %', p_note_id, sqlerrm;
  end;
end;
$$;

grant execute on function public.teacher_delete_feedback_note(uuid) to authenticated;
