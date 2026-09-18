-- French Punjabi — Let a student read their OWN enrollment row
-- Run this once in the Supabase SQL Editor, after 016_attendance.sql.
--
-- enrollments only ever had an admin-only select policy (003_enrollments.sql),
-- which silently blocks getCurrentBatch() (src/lib/student/getCurrentBatch.ts)
-- from working for a real student session: the query for their own batch_id
-- returns zero rows under RLS, not an error, so the attendance page always
-- rendered "No batch assigned yet" even for a student with a confirmed,
-- batched enrollment. Mirrors students_self_select (006_student_accounts.sql)
-- and attendance_self_select (016_attendance.sql).

drop policy if exists "enrollments_self_select" on public.enrollments;
create policy "enrollments_self_select" on public.enrollments
  for select using (
    exists (
      select 1 from public.students s
      where s.id = enrollments.student_id and s.auth_user_id = auth.uid()
    )
  );
