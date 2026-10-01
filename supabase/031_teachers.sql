-- French Punjabi — Teachers: accounts, batch assignment, admin-only
-- payments/hours bookkeeping, and the auth plumbing a Teacher Portal
-- needs. Run after 028_batch_change_history.sql.
--
-- Mirrors the STUDENTS account model (006/011/013), not admin_users — a
-- teacher's row is created by an admin "by email" before any Supabase
-- Auth account necessarily exists; the auth account is provisioned/linked
-- afterward via the same invite-email pattern already used for students
-- (see src/lib/students/inviteAndLink.ts -> src/lib/teachers/inviteAndLink.ts).

-- =========================================================
-- Tables
-- =========================================================

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  -- Generated + unique, same dedupe trick as students.email_key (006) —
  -- keeps "does this email already have a teacher account" a plain index
  -- lookup regardless of case/whitespace.
  email_key text generated always as (lower(trim(email))) stored,
  auth_user_id uuid unique references auth.users (id),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teachers_email_key_key unique (email_key),
  constraint teachers_status_check check (status in ('ACTIVE', 'DEACTIVATED'))
);

create index if not exists teachers_auth_user_id_idx on public.teachers (auth_user_id);

drop trigger if exists set_updated_at on public.teachers;
create trigger set_updated_at before update on public.teachers
  for each row execute function public.set_updated_at();

-- Batch assignment — one teacher per batch, nullable (not every batch has
-- one). ON DELETE SET NULL: hard-deleting a teacher (see "Remove" in the
-- admin Teachers tab) must never cascade into deleting the batch itself —
-- it just becomes unassigned again.
alter table public.batches add column if not exists teacher_id uuid references public.teachers (id) on delete set null;
create index if not exists batches_teacher_id_idx on public.batches (teacher_id);

-- Permanent, admin-editable portal password — same trade-off/reasoning as
-- student_portal_credentials (011): kept off the teachers table itself so
-- it can never accidentally ride along on a `select *`.
create table if not exists public.teacher_portal_credentials (
  teacher_id uuid primary key references public.teachers (id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.teacher_portal_credentials;
create trigger set_updated_at before update on public.teacher_portal_credentials
  for each row execute function public.set_updated_at();

-- Permanent, no-password portal access link — same shape as
-- student_portal_access (013).
create table if not exists public.teacher_portal_access (
  teacher_id uuid primary key references public.teachers (id) on delete cascade,
  access_token text not null unique,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.teacher_portal_access;
create trigger set_updated_at before update on public.teacher_portal_access
  for each row execute function public.set_updated_at();

-- Admin's own bookkeeping about a teacher. Deliberately NOT visible to
-- the teacher themselves under any circumstance — see RLS below, there is
-- no self-select policy at all on either of these two tables, by design.
--
-- teacher_id is nullable + ON DELETE SET NULL (not CASCADE): hard-deleting
-- a teacher (Remove, in the admin Teachers tab) must never destroy their
-- payment/hours history — that's real accounting data. teacher_name_snapshot
-- freezes the name at write time so a row stays readable by name even
-- after the teacher behind it is gone, mirroring how enrollments freezes
-- phase_name/level_name/batch_timing (see supabase/003_enrollments.sql).
create table if not exists public.teacher_payments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.teachers (id) on delete set null,
  teacher_name_snapshot text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'CAD',
  paid_at date not null default current_date,
  note text,
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_payments_teacher_id_idx on public.teacher_payments (teacher_id);

drop trigger if exists set_updated_at on public.teacher_payments;
create trigger set_updated_at before update on public.teacher_payments
  for each row execute function public.set_updated_at();

create table if not exists public.teacher_hours (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.teachers (id) on delete set null,
  teacher_name_snapshot text not null,
  -- The Monday (or whatever day the admin picks) each row's hours are for —
  -- a plain date, not a timestamp: this is a bookkeeping bucket, not an event.
  week_start date not null,
  hours numeric(5, 2) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_hours_unique unique (teacher_id, week_start)
);

create index if not exists teacher_hours_teacher_id_idx on public.teacher_hours (teacher_id);

drop trigger if exists set_updated_at on public.teacher_hours;
create trigger set_updated_at before update on public.teacher_hours
  for each row execute function public.set_updated_at();

-- =========================================================
-- Authorization helpers — mirror is_admin()/is_active_student() exactly,
-- so every teacher-scoped policy anywhere (this migration and future
-- ones) goes through ONE definition of "who is the calling teacher,"
-- never an inline auth.uid() lookup scattered around.
-- =========================================================

create or replace function public.is_active_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.teachers
    where auth_user_id = auth.uid() and status = 'ACTIVE'
  );
$$;

grant execute on function public.is_active_teacher() to authenticated;

-- The calling teacher's own id, or null if the caller isn't an ACTIVE
-- teacher. Every future teacher-scoped RLS policy (batches, attendance,
-- student visibility, messaging, feedback notes — later migrations) is
-- built as `... = public.current_teacher_id()`, never a raw auth.uid().
create or replace function public.current_teacher_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.teachers where auth_user_id = auth.uid() and status = 'ACTIVE';
$$;

grant execute on function public.current_teacher_id() to authenticated;

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.teachers enable row level security;
alter table public.teacher_portal_credentials enable row level security;
alter table public.teacher_portal_access enable row level security;
alter table public.teacher_payments enable row level security;
alter table public.teacher_hours enable row level security;

-- teachers: admin manages everything; a teacher may see only their OWN
-- row (mirrors students_self_select) — this is what the future portal
-- layout's "am I an approved, active teacher" check will run against.
-- No self-select row here ever exposes another teacher's name/email:
-- `auth_user_id = auth.uid()` can only ever match the caller's own row.
drop policy if exists "teachers_admin_write" on public.teachers;
create policy "teachers_admin_write" on public.teachers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teachers_self_select" on public.teachers;
create policy "teachers_self_select" on public.teachers
  for select using (auth_user_id = auth.uid());

-- teacher_portal_credentials / teacher_portal_access — admin-only, full
-- stop, identical reasoning to the student equivalents (011/013): a
-- teacher's own session must never be able to read their own
-- password/access-token back, even though the row is "theirs."
drop policy if exists "teacher_portal_credentials_admin_write" on public.teacher_portal_credentials;
create policy "teacher_portal_credentials_admin_write" on public.teacher_portal_credentials
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teacher_portal_access_admin_write" on public.teacher_portal_access;
create policy "teacher_portal_access_admin_write" on public.teacher_portal_access
  for all using (public.is_admin()) with check (public.is_admin());

-- teacher_payments / teacher_hours — admin-only, full stop. Deliberately
-- NO self-select policy of any kind: this data must be unreachable by a
-- teacher's own session even via a direct query, not just hidden in the
-- UI (see the RLS smoke tests run before this migration was applied).
drop policy if exists "teacher_payments_admin_write" on public.teacher_payments;
create policy "teacher_payments_admin_write" on public.teacher_payments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "teacher_hours_admin_write" on public.teacher_hours;
create policy "teacher_hours_admin_write" on public.teacher_hours
  for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================
-- Narrow, anon-callable token resolver — mirrors
-- resolve_portal_access_token() in 013_student_portal_access_link.sql.
-- Will be used by src/app/teacher/access/[token]/route.ts (a future
-- phase), hit by a signed-out browser by definition.
-- =========================================================

create or replace function public.resolve_teacher_portal_access_token(p_token text)
returns table (teacher_id uuid, email text, status text)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.email, t.status
  from public.teachers t
  join public.teacher_portal_access tpa on tpa.teacher_id = t.id
  where tpa.access_token = p_token;
$$;

grant execute on function public.resolve_teacher_portal_access_token(text) to anon, authenticated;

-- =========================================================
-- Grants — RLS restricts *which rows*; these grant the underlying verbs.
-- Writes are further gated by the admin-only policies above, so granting
-- insert/update/delete to `authenticated` here does not let a non-admin
-- signed-in user (a teacher included) write anything on these tables.
-- =========================================================

grant select on public.teachers to authenticated;
grant insert, update, delete on public.teachers to authenticated;

grant select, insert, update, delete on
  public.teacher_portal_credentials, public.teacher_portal_access, public.teacher_payments, public.teacher_hours
  to authenticated;
