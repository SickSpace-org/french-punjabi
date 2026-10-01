-- French Punjabi — Multiple videos per lesson
-- Run this once in the Supabase SQL Editor, after 020_backfill_class_time.sql.
--
-- course_lessons.video_url/video_provider only ever held ONE video per
-- lesson. This adds lesson_videos, structured exactly like
-- lesson_resources (007_course_content.sql) — one row per video, admin can
-- add/rename/remove any number of them — and backfills each lesson's
-- existing single video in as its first row. The old columns are left in
-- place (untouched, no longer read by the app) rather than dropped, so
-- nothing about this migration is destructive.

create table if not exists public.lesson_videos (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.course_lessons (id) on delete cascade,
  title text not null,
  video_url text not null,
  video_provider text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_videos_lesson_id_idx on public.lesson_videos (lesson_id);

alter table public.lesson_videos enable row level security;

drop policy if exists "lesson_videos_admin_write" on public.lesson_videos;
create policy "lesson_videos_admin_write" on public.lesson_videos
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "lesson_videos_student_select" on public.lesson_videos;
create policy "lesson_videos_student_select" on public.lesson_videos
  for select using (
    exists (
      select 1 from public.course_lessons l
      where l.id = lesson_id
        and l.status = 'PUBLISHED'
        and l.is_active
        and public.has_course_access(l.course_id)
    )
  );

-- One-time backfill — guarded by "not exists" so re-running this file is
-- harmless and never duplicates a row.
insert into public.lesson_videos (lesson_id, title, video_url, video_provider, display_order)
select id, title, video_url, video_provider, 0
from public.course_lessons cl
where video_url is not null
  and video_provider is not null
  and not exists (select 1 from public.lesson_videos lv where lv.lesson_id = cl.id);
