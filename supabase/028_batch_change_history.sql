-- French Punjabi — Batch change history: a durable log of every time a
-- confirmed student's batch/level changes, whether via the bulk Swap
-- Batches admin page (see src/app/admin/(dashboard)/swap-batches/actions.ts)
-- or a manual single reassignment on Students (updateStudentCourse). Run
-- this once in the Supabase SQL Editor, after 027_urgent_reassert_course_content_rls.sql.
--
-- Without this, reassigning a student's course just UPDATEs their one
-- enrollment row's batch/level columns in place — nothing remembered what
-- they used to be in. Stores frozen "from"/"to" text labels rather than
-- batch ids, since a swapped-out batch gets deactivated (and could later be
-- deleted outright) — the same freeze-at-the-time-of-the-event approach
-- resolveCourseNames.ts already uses for phase_name/level_name/batch_timing.

create table if not exists public.batch_change_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  from_label text not null,
  to_label text not null,
  changed_at timestamptz not null default now()
);

create index if not exists batch_change_history_student_id_idx
  on public.batch_change_history (student_id, changed_at desc);

alter table public.batch_change_history enable row level security;

drop policy if exists "batch_change_history_admin_all" on public.batch_change_history;
create policy "batch_change_history_admin_all" on public.batch_change_history
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert on public.batch_change_history to authenticated;
