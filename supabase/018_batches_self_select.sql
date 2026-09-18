-- French Punjabi — Let an enrolled student read their OWN (possibly closed) batch
-- Run this once in the Supabase SQL Editor, after 017_enrollments_self_select.sql.
--
-- batches_public_select (001_schema.sql) only allows a signed-in student to
-- see a batch while it's still open for new signups (is_active = true,
-- availability_status <> 'hidden'). A batch that has since filled up gets
-- marked is_active = false — completely normal, and exactly the state a
-- student's own batch is usually in by the time they're taking classes —
-- which silently blocked getCurrentBatch() (src/lib/student/getCurrentBatch.ts)
-- from reading meeting_link/class_days/time_label for their own batch, even
-- though enrollments_self_select (017) now lets them find its batch_id.
-- Mirrors that same "own row via students.auth_user_id" pattern.

drop policy if exists "batches_self_select" on public.batches;
create policy "batches_self_select" on public.batches
  for select using (
    exists (
      select 1 from public.enrollments e
      join public.students s on s.id = e.student_id
      where e.batch_id = batches.id and s.auth_user_id = auth.uid()
    )
  );
