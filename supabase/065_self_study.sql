-- French Punjabi — Self Study: homework PDFs from the teacher, and PDF /
-- voice-recording submissions from students. Run this once in the Supabase
-- SQL Editor, after 064_resources_youtube_links.sql.
--
-- Everything here is temporary on purpose: every row and every file lives
-- for 3 days. Rows past `expires_at` are hidden by RLS straight away, and
-- the app's cleanup job (src/lib/selfStudy/cleanup.ts — run daily by the
-- Vercel cron in vercel.json, and opportunistically when the Self Study
-- pages load) deletes the expired files from Storage and the rows here.
--
-- Storage layout in the private `self-study` bucket:
--   assignments/{timestamp}-{filename}            (uploaded by an admin)
--   submissions/{student_id}/{timestamp}-{file}   (uploaded by that student)

-- =========================================================
-- 1. Helper: the caller's own ACTIVE student id (null for anyone else).
-- =========================================================

create or replace function public.current_student_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.students
  where auth_user_id = auth.uid() and status = 'ACTIVE'
  limit 1;
$$;

grant execute on function public.current_student_id() to authenticated;

-- =========================================================
-- 2. Tables
-- =========================================================

-- Homework / classwork PDFs the admin shares. batch_id null = every student.
create table if not exists public.self_study_assignments (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  note          text,
  batch_id      uuid references public.batches (id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '3 days'
);

create index if not exists self_study_assignments_expires_idx
  on public.self_study_assignments (expires_at);

-- What students send back: a PDF or a voice recording, optionally tied to a
-- homework item.
create table if not exists public.self_study_submissions (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students (id) on delete cascade,
  assignment_id     uuid references public.self_study_assignments (id) on delete set null,
  kind              text not null check (kind in ('PDF', 'VOICE')),
  note              text,
  storage_path      text not null unique,
  file_name         text not null,
  duration_seconds  integer,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '3 days'
);

create index if not exists self_study_submissions_student_idx
  on public.self_study_submissions (student_id);
create index if not exists self_study_submissions_expires_idx
  on public.self_study_submissions (expires_at);

-- Nobody (student or admin) can stretch the 3-day lifetime: the clock is
-- always set by the database on insert and can't be changed afterwards.
create or replace function public.self_study_set_expiry()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.expires_at := now() + interval '3 days';
  else
    new.created_at := old.created_at;
    new.expires_at := old.expires_at;
  end if;
  return new;
end;
$$;

drop trigger if exists self_study_assignments_expiry on public.self_study_assignments;
create trigger self_study_assignments_expiry
  before insert or update on public.self_study_assignments
  for each row execute function public.self_study_set_expiry();

drop trigger if exists self_study_submissions_expiry on public.self_study_submissions;
create trigger self_study_submissions_expiry
  before insert or update on public.self_study_submissions
  for each row execute function public.self_study_set_expiry();

-- =========================================================
-- 3. Row Level Security
-- =========================================================

alter table public.self_study_assignments enable row level security;
alter table public.self_study_submissions enable row level security;

drop policy if exists "self_study_assignments_admin_all" on public.self_study_assignments;
create policy "self_study_assignments_admin_all" on public.self_study_assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- A student sees live homework meant for everyone, or for a batch they're
-- enrolled in.
drop policy if exists "self_study_assignments_student_select" on public.self_study_assignments;
create policy "self_study_assignments_student_select" on public.self_study_assignments
  for select using (
    public.is_active_student()
    and expires_at > now()
    and (
      batch_id is null
      or exists (
        select 1 from public.enrollments e
        where e.student_id = public.current_student_id()
          and e.batch_id = self_study_assignments.batch_id
      )
    )
  );

drop policy if exists "self_study_submissions_admin_all" on public.self_study_submissions;
create policy "self_study_submissions_admin_all" on public.self_study_submissions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "self_study_submissions_student_select" on public.self_study_submissions;
create policy "self_study_submissions_student_select" on public.self_study_submissions
  for select using (student_id = public.current_student_id() and expires_at > now());

-- Students can only send work as themselves, into their own folder, and
-- can't mark it reviewed.
drop policy if exists "self_study_submissions_student_insert" on public.self_study_submissions;
create policy "self_study_submissions_student_insert" on public.self_study_submissions
  for insert with check (
    student_id = public.current_student_id()
    and reviewed_at is null
    and storage_path like 'submissions/' || public.current_student_id()::text || '/%'
  );

drop policy if exists "self_study_submissions_student_delete" on public.self_study_submissions;
create policy "self_study_submissions_student_delete" on public.self_study_submissions
  for delete using (student_id = public.current_student_id());

grant select, insert, update, delete on public.self_study_assignments to authenticated;
grant select, insert, update, delete on public.self_study_submissions to authenticated;

-- =========================================================
-- 4. Private Storage bucket (25 MB per file, PDFs and audio only)
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'self-study', 'self-study', false, 26214400,
  array[
    'application/pdf',
    'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
    'audio/x-wav', 'audio/aac', 'audio/x-m4a'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "self_study_storage_admin_all" on storage.objects;
create policy "self_study_storage_admin_all" on storage.objects
  for all using (bucket_id = 'self-study' and public.is_admin())
  with check (bucket_id = 'self-study' and public.is_admin());

-- A student can upload only into submissions/{their own student id}/.
-- Reading files goes through short-lived signed URLs the app mints after
-- re-checking the row above, so no student select policy is needed.
drop policy if exists "self_study_storage_student_insert" on storage.objects;
create policy "self_study_storage_student_insert" on storage.objects
  for insert with check (
    bucket_id = 'self-study'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = public.current_student_id()::text
  );

-- =========================================================
-- 5. Cleanup helper: every file in the bucket older than 3 days — including
--    strays whose row was never saved or was already deleted. Only the
--    service role (the cleanup job) may call it.
-- =========================================================

create or replace function public.self_study_expired_objects()
returns setof text
language sql
security definer
set search_path = public, storage
stable
as $$
  select name from storage.objects
  where bucket_id = 'self-study'
    and created_at < now() - interval '3 days';
$$;

revoke execute on function public.self_study_expired_objects() from public, anon, authenticated;
grant execute on function public.self_study_expired_objects() to service_role;
