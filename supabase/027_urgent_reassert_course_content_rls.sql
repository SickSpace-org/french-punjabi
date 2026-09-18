-- URGENT — re-assert course_content RLS after confirming students can read
-- DRAFT / inactive lessons directly (verified live: signed in as a real
-- student and queried course_lessons with no filters — draft/inactive rows
-- came back). Safe to run any number of times; every statement is
-- idempotent and matches supabase/007_course_content.sql exactly, so this
-- cannot remove access that should exist — it only re-locks down what
-- should already have been locked down.

alter table public.course_content enable row level security;
alter table public.course_weeks enable row level security;
alter table public.course_lessons enable row level security;
alter table public.lesson_resources enable row level security;

drop policy if exists "course_content_admin_write" on public.course_content;
create policy "course_content_admin_write" on public.course_content
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_content_student_select" on public.course_content;
create policy "course_content_student_select" on public.course_content
  for select using (status = 'PUBLISHED' and is_active and public.has_course_access(id));

drop policy if exists "course_weeks_admin_write" on public.course_weeks;
create policy "course_weeks_admin_write" on public.course_weeks
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_weeks_student_select" on public.course_weeks;
create policy "course_weeks_student_select" on public.course_weeks
  for select using (
    status = 'PUBLISHED'
    and is_active
    and public.has_course_access(course_id)
    and exists (
      select 1 from public.course_content c
      where c.id = course_id and c.status = 'PUBLISHED' and c.is_active
    )
  );

drop policy if exists "course_lessons_admin_write" on public.course_lessons;
create policy "course_lessons_admin_write" on public.course_lessons
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "course_lessons_student_select" on public.course_lessons;
create policy "course_lessons_student_select" on public.course_lessons
  for select using (
    status = 'PUBLISHED'
    and is_active
    and public.has_course_access(course_id)
    and exists (
      select 1 from public.course_weeks w
      where w.id = week_id and w.status = 'PUBLISHED' and w.is_active
    )
    and exists (
      select 1 from public.course_content c
      where c.id = course_id and c.status = 'PUBLISHED' and c.is_active
    )
  );

drop policy if exists "lesson_resources_admin_write" on public.lesson_resources;
create policy "lesson_resources_admin_write" on public.lesson_resources
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "lesson_resources_student_select" on public.lesson_resources;
create policy "lesson_resources_student_select" on public.lesson_resources
  for select using (
    exists (
      select 1 from public.course_lessons l
      where l.id = lesson_id
        and l.status = 'PUBLISHED'
        and l.is_active
        and public.has_course_access(l.course_id)
    )
  );

-- Diagnostic — list every policy left on these 4 tables afterward, so we
-- can see if anything unexpected (a leftover permissive policy from an
-- earlier version) is still present and needs manual removal.
select tablename, policyname, cmd, roles
from pg_policies
where tablename in ('course_content', 'course_weeks', 'course_lessons', 'lesson_resources')
order by tablename, policyname;
