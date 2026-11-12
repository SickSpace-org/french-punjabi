-- French Punjabi — Assignments: the admin shares assignment PDFs (with
-- everyone or one batch), students submit their finished work as a PDF,
-- and the admin opens it and marks it checked. Run this once in the
-- Supabase SQL Editor, after 065_self_study.sql (it reuses
-- public.current_student_id() and public.self_study_set_expiry() from there).
--
-- Like Self Study, everything is temporary: every row and every file lives
-- for 3 days. Rows past `expires_at` are hidden by RLS straight away, and
-- the app's cleanup job (src/lib/assignments/cleanup.ts — run by the daily
-- Vercel cron and opportunistically when the Assignments pages load)
-- deletes the expired files from Storage and the rows here.
--
-- Storage layout in the private `assignments` bucket:
--   tasks/{timestamp}-{filename}                  (uploaded by an admin)
--   submissions/{student_id}/{timestamp}-{file}   (uploaded by that student)

-- =========================================================
-- 1. Tables
-- =========================================================

-- batch_id null = every student.
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  note          text,
  batch_id      uuid references public.batches (id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '3 days'
);

create index if not exists assignments_expires_idx on public.assignments (expires_at);

-- A student's finished work for one assignment. A student may submit more
-- than once (e.g. a corrected version). assignment_title is copied from the
-- assignment on insert, so the submission still says what it was for after
-- the assignment itself has expired.
create table if not exists public.assignment_submissions (
  id                uuid primary key default gen_random_uuid(),
  assignment_id     uuid references public.assignments (id) on delete set null,
  assignment_title  text not null default '',
  student_id        uuid not null references public.students (id) on delete cascade,
  note              text,
  storage_path      text not null unique,
  file_name         text not null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '3 days'
);

create index if not exists assignment_submissions_assignment_idx on public.assignment_submissions (assignment_id);
create index if not exists assignment_submissions_student_idx on public.assignment_submissions (student_id);
create index if not exists assignment_submissions_expires_idx on public.assignment_submissions (expires_at);

-- Nobody can stretch the 3-day lifetime: the clock is set by the database
-- on insert and can't be changed afterwards (same function as Self Study).
drop trigger if exists assignments_expiry on public.assignments;
create trigger assignments_expiry
  before insert or update on public.assignments
  for each row execute function public.self_study_set_expiry();

drop trigger if exists assignment_submissions_expiry on public.assignment_submissions;
create trigger assignment_submissions_expiry
  before insert or update on public.assignment_submissions
  for each row execute function public.self_study_set_expiry();

create or replace function public.assignment_submissions_copy_title()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select a.title into new.assignment_title from public.assignments a where a.id = new.assignment_id;
  new.assignment_title := coalesce(new.assignment_title, '');
  return new;
end;
$$;

drop trigger if exists assignment_submissions_title on public.assignment_submissions;
create trigger assignment_submissions_title
  before insert on public.assignment_submissions
  for each row execute function public.assignment_submissions_copy_title();

-- =========================================================
-- 2. Row Level Security
-- =========================================================

alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

drop policy if exists "assignments_admin_all" on public.assignments;
create policy "assignments_admin_all" on public.assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- A student sees live assignments meant for everyone, or for a batch
-- they're enrolled in.
drop policy if exists "assignments_student_select" on public.assignments;
create policy "assignments_student_select" on public.assignments
  for select using (
    public.is_active_student()
    and expires_at > now()
    and (
      batch_id is null
      or exists (
        select 1 from public.enrollments e
        where e.student_id = public.current_student_id()
          and e.batch_id = assignments.batch_id
      )
    )
  );

drop policy if exists "assignment_submissions_admin_all" on public.assignment_submissions;
create policy "assignment_submissions_admin_all" on public.assignment_submissions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "assignment_submissions_student_select" on public.assignment_submissions;
create policy "assignment_submissions_student_select" on public.assignment_submissions
  for select using (student_id = public.current_student_id() and expires_at > now());

-- Students can only submit as themselves, into their own folder, for a
-- live assignment they can see, and can't mark their own work checked.
drop policy if exists "assignment_submissions_student_insert" on public.assignment_submissions;
create policy "assignment_submissions_student_insert" on public.assignment_submissions
  for insert with check (
    student_id = public.current_student_id()
    and reviewed_at is null
    and storage_path like 'submissions/' || public.current_student_id()::text || '/%'
    and assignment_id is not null
    and exists (select 1 from public.assignments a where a.id = assignment_id)
  );

-- A student can take back a submission only until the teacher has checked it.
drop policy if exists "assignment_submissions_student_delete" on public.assignment_submissions;
create policy "assignment_submissions_student_delete" on public.assignment_submissions
  for delete using (student_id = public.current_student_id() and reviewed_at is null);

grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.assignment_submissions to authenticated;

-- =========================================================
-- 3. Private Storage bucket (25 MB per file, PDFs only)
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignments', 'assignments', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "assignments_storage_admin_all" on storage.objects;
create policy "assignments_storage_admin_all" on storage.objects
  for all using (bucket_id = 'assignments' and public.is_admin())
  with check (bucket_id = 'assignments' and public.is_admin());

-- A student can upload only into submissions/{their own student id}/.
-- Reading files goes through short-lived signed URLs the app mints after
-- re-checking the rows above, so no student select policy is needed.
drop policy if exists "assignments_storage_student_insert" on storage.objects;
create policy "assignments_storage_student_insert" on storage.objects
  for insert with check (
    bucket_id = 'assignments'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = public.current_student_id()::text
  );

-- =========================================================
-- 4. Cleanup helper: every file in the bucket older than 3 days — including
--    strays whose row was never saved. Only the service role (the cleanup
--    job) may call it.
-- =========================================================

create or replace function public.assignments_expired_objects()
returns setof text
language sql
security definer
set search_path = public, storage
stable
as $$
  select name from storage.objects
  where bucket_id = 'assignments'
    and created_at < now() - interval '3 days';
$$;

revoke execute on function public.assignments_expired_objects() from public, anon, authenticated;
grant execute on function public.assignments_expired_objects() to service_role;
