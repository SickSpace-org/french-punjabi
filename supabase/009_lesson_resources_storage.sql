-- French Punjabi — Private Storage bucket for lesson resources (PDFs,
-- worksheets, notes). Run after 007_course_content.sql (needs
-- has_course_access()).
--
-- Objects are uploaded under the path convention:
--   {course_id}/{lesson_id}/{filename}
-- so storage.foldername(name)[1] is the course_id, making the student
-- read policy a cheap has_course_access() check. Students never get a
-- public URL — the app mints short-lived signed URLs server-side after
-- re-checking access.

insert into storage.buckets (id, name, public)
values ('lesson-resources', 'lesson-resources', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase itself (its owning
-- role differs from the `postgres` role these migrations run as, so we
-- can't/don't need to ALTER it ourselves — only CREATE POLICY, which is
-- permitted).

drop policy if exists "lesson_resources_storage_admin_all" on storage.objects;
create policy "lesson_resources_storage_admin_all" on storage.objects
  for all using (bucket_id = 'lesson-resources' and public.is_admin())
  with check (bucket_id = 'lesson-resources' and public.is_admin());

drop policy if exists "lesson_resources_storage_student_select" on storage.objects;
create policy "lesson_resources_storage_student_select" on storage.objects
  for select using (
    bucket_id = 'lesson-resources'
    and public.has_course_access(((storage.foldername(name))[1])::uuid)
  );
