-- French Punjabi — Teacher Portal, Phase 3: lets an ACTIVE teacher view
-- AND manually mark attendance (present/absent) for their own assigned
-- batch(es) only. Run after 034_remove_teacher_students_table_access.sql.
--
-- Design decision, spelled out: teachers get the SAME manual-override
-- capability admins already have (see setAttendanceStatus,
-- src/app/admin/(dashboard)/courses/actions.ts) — scoped to their own
-- batch — rather than a separate, parallel mechanism. setAttendanceStatus
-- itself is reused UNCHANGED for teachers: it has no app-level role check
-- today (see 019_attendance_time_window_and_admin_override.sql —
-- attendance_admin_write is the only thing gating it), relying entirely
-- on RLS, exactly as the rest of this codebase's philosophy states
-- everywhere ("RLS is the real boundary, app code is only UX"). Adding a
-- second write path here would be the "second, inconsistent way to edit
-- the same data" this migration deliberately avoids — there is exactly
-- one function that writes an attendance row (upsert = Present, delete =
-- Absent), used by both roles, with RLS alone deciding who's allowed for
-- which batch.
--
-- batch_owned_by_current_teacher() is the explicit, auditable ownership
-- check requested for the write path — mirroring how teacher_batch_roster()
-- (030) already does an explicit ownership check for the read side, not
-- just implicit table-level access. It's `language plpgsql` (not sql) —
-- see 033_fix_teacher_rls_recursion.sql for why: a `language sql` security
-- definer function referencing another RLS-protected table from inside a
-- policy can get inlined by the planner and lose its privilege boundary,
-- producing "infinite recursion detected in policy." plpgsql functions are
-- never inlined, so this is safe from that class of bug by construction.

create or replace function public.batch_owned_by_current_teacher(p_batch_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.batches b
    where b.id = p_batch_id and b.teacher_id = public.current_teacher_id()
  );
end;
$$;

grant execute on function public.batch_owned_by_current_teacher(uuid) to authenticated;

-- Viewing — additive to attendance_admin_select (016) and
-- attendance_self_select (016), both untouched.
drop policy if exists "attendance_teacher_select" on public.attendance;
create policy "attendance_teacher_select" on public.attendance
  for select using (public.batch_owned_by_current_teacher(batch_id));

-- Manual override (insert = mark Present, delete = mark Absent, exactly
-- like setAttendanceStatus's existing admin behavior) — additive to
-- attendance_admin_write (019), untouched. A teacher can never affect a
-- row whose batch_id isn't currently one of their own assigned batches —
-- re-checked on every single call via batch_owned_by_current_teacher(),
-- not cached or assumed from a prior request.
drop policy if exists "attendance_teacher_write" on public.attendance;
create policy "attendance_teacher_write" on public.attendance
  for all using (public.batch_owned_by_current_teacher(batch_id))
  with check (public.batch_owned_by_current_teacher(batch_id));
