-- French Punjabi — Permanent, admin-editable portal password per student.
-- Run after 006_student_accounts.sql.
--
-- Deliberately a SEPARATE table from students (not a column on it) — the
-- students table has a self-select RLS policy (students_self_select) so a
-- student's own portal queries can read their own row; keeping the
-- password on students would risk it accidentally being fetched/returned
-- by student-facing code (getCurrentStudent does `select *`). This table
-- has NO self-select policy at all — admin-only, full stop.
--
-- This is a real trade-off: Supabase Auth never lets anyone read a
-- password back once set (only compare against it) — storing our own
-- plaintext copy here is what makes "view/edit anytime" possible, at the
-- cost of a second, human-readable copy of each student's password
-- existing in the database.

create table if not exists public.student_portal_credentials (
  student_id uuid primary key references public.students (id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.student_portal_credentials;
create trigger set_updated_at before update on public.student_portal_credentials
  for each row execute function public.set_updated_at();

alter table public.student_portal_credentials enable row level security;

drop policy if exists "student_portal_credentials_admin_write" on public.student_portal_credentials;
create policy "student_portal_credentials_admin_write" on public.student_portal_credentials
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.student_portal_credentials to authenticated;
