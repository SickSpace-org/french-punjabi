-- French Punjabi — Simplify course access: any ACTIVE (enrolled/paid)
-- student sees ALL published course content, not just courses an admin
-- explicitly assigned to them one at a time.
--
-- has_course_access() is the single choke point every content/progress/
-- comments/storage RLS policy already calls (see 007/008/009) — redefining
-- its body here is enough to change the access model everywhere at once,
-- without touching any of those policies individually.
--
-- student_course_access is left in place (unused for gating from now on,
-- but harmless) in case per-course restriction is wanted again later.

create or replace function public.has_course_access(p_course_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_active_student();
$$;
