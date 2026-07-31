-- French Punjabi — Private Storage bucket for uploaded lesson videos
-- (as opposed to pasted YouTube/Vimeo/external links, which just live in
-- course_lessons.video_url as-is). Run after 007_course_content.sql (needs
-- has_course_access()).
--
-- Objects are uploaded under the same path convention as lesson-resources:
--   {course_id}/{lesson_id}/{filename}
-- so storage.foldername(name)[1] is the course_id, making the student
-- read policy a cheap has_course_access() check. Students never get a
-- public URL — the app mints a signed URL server-side (see
-- src/lib/student/getLessonDetail.ts) after re-checking access.
--
-- file_size_limit is set generously (5 GB) to comfortably fit an hour-long
-- lecture recording. NOTE: this only lifts Supabase's per-file cap — actual
-- upload success and playback still depend on your project's Storage plan
-- (total storage + bandwidth/egress), which you may need to upgrade for
-- routine multi-hundred-MB video uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-videos',
  'lesson-videos',
  false,
  5368709120, -- 5 GB
  array['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by Supabase itself (its owning
-- role differs from the `postgres` role these migrations run as, so we
-- can't/don't need to ALTER it ourselves — only CREATE POLICY, which is
-- permitted).

drop policy if exists "lesson_videos_storage_admin_all" on storage.objects;
create policy "lesson_videos_storage_admin_all" on storage.objects
  for all using (bucket_id = 'lesson-videos' and public.is_admin())
  with check (bucket_id = 'lesson-videos' and public.is_admin());

drop policy if exists "lesson_videos_storage_student_select" on storage.objects;
create policy "lesson_videos_storage_student_select" on storage.objects
  for select using (
    bucket_id = 'lesson-videos'
    and public.has_course_access(((storage.foldername(name))[1])::uuid)
  );
