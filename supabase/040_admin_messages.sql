-- French Punjabi — Teacher Portal extension, Phase 7a: admin batch-wide
-- messaging. Run after 039_student_feedback_notes.sql.
--
-- REUSE, not a new table — checked the actual shape before deciding, same
-- process as every extend-vs-new decision in this project. teacher_messages
-- (036) already has everything this needs: a nullable teacher_id, the
-- broadcast_id fan-out pattern for whole-batch sends, and — the key fact —
-- teacher_messages_admin_write already grants admin unrestricted read/write
-- via is_admin() with NO batch-ownership check, so "any batch, not scoped
-- to one teacher's assignment" is already true today with zero RLS changes.
--
-- The one real gap: teacher_id = null is ALREADY used to mean "the teacher
-- who sent this has since been hard-deleted" (see 036's own comment).
-- Reusing bare null for "sent by admin" would make those two cases
-- indistinguishable — hence the explicit is_admin_message flag below,
-- rather than inferring sender kind from teacher_id alone.
--
-- No audit trail for admin messages, by confirmed design: batch_change_history
-- (028), the closest existing "event log" in this app, has no actor-
-- attribution column at all — admin actions aren't individually logged the
-- way teacher_content_audit logs teachers. This keeps that precedent.

alter table public.teacher_messages add column if not exists is_admin_message boolean not null default false;

-- =========================================================
-- admin_send_message() — the ONLY way an admin session writes here.
-- Authorization is just is_admin() — no batch_owned_by_current_teacher()
-- check at all, since admin isn't scoped to any batch. p_student_id = null
-- means "send to every student currently in this batch", same convention
-- as teacher_send_message() (036) — mirrors its lateral-join "current
-- batch per student" resolution rather than teacher_batch_roster(), since
-- that function's ownership check would always fail for an admin session
-- (current_teacher_id() is null for a non-teacher caller).
-- =========================================================

create or replace function public.admin_send_message(
  p_batch_id uuid, p_student_id uuid, p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_broadcast_id uuid;
  v_recipient_count int := 0;
  r record;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'message body is required';
  end if;
  if not exists (select 1 from public.batches where id = p_batch_id) then
    raise exception 'batch not found';
  end if;

  v_broadcast_id := gen_random_uuid();

  if p_student_id is not null then
    if not exists (
      select 1
      from public.students s
      cross join lateral (
        select e2.batch_id
        from public.enrollments e2
        where e2.student_id = s.id and e2.batch_id is not null
        order by e2.created_at desc
        limit 1
      ) e
      where s.id = p_student_id and s.status = 'ACTIVE' and e.batch_id = p_batch_id
    ) then
      raise exception 'student is not currently in this batch';
    end if;

    insert into public.teacher_messages (broadcast_id, batch_id, teacher_id, teacher_name_snapshot, student_id, body, is_admin_message)
    values (v_broadcast_id, p_batch_id, null, 'Admin', p_student_id, trim(p_body), true);
    v_recipient_count := 1;
  else
    for r in
      select s.id as student_id
      from public.students s
      cross join lateral (
        select e2.batch_id
        from public.enrollments e2
        where e2.student_id = s.id and e2.batch_id is not null
        order by e2.created_at desc
        limit 1
      ) e
      where s.status = 'ACTIVE' and e.batch_id = p_batch_id
    loop
      insert into public.teacher_messages (broadcast_id, batch_id, teacher_id, teacher_name_snapshot, student_id, body, is_admin_message)
      values (v_broadcast_id, p_batch_id, null, 'Admin', r.student_id, trim(p_body), true);
      v_recipient_count := v_recipient_count + 1;
    end loop;

    if v_recipient_count = 0 then
      raise exception 'no students currently in this batch to message';
    end if;
  end if;

  return v_broadcast_id;
end;
$$;

grant execute on function public.admin_send_message(uuid, uuid, text) to authenticated;
