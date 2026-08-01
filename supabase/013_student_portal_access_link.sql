-- French Punjabi — Permanent, no-password portal access link.
-- Run after 011_student_portal_credentials.sql (needs is_admin()).
--
-- Once payment is confirmed, the student's ONLY onboarding step is
-- clicking one bookmarkable link (emailed once, resendable/regenerable
-- from the admin panel) — no password, no code, no separate "verify"
-- step. Visiting /student/access/{token} looks up this row (via the
-- narrow function below, not direct table access), mints a FRESH
-- Supabase magic-link server-side, and immediately redirects into it —
-- so the durable secret is our own token, never a Supabase one-time
-- link. That also sidesteps the earlier "email scanner burns the
-- one-time link before the student opens it" problem: every visit
-- (scanner or human) transparently gets its own freshly-minted,
-- immediately-consumed Supabase link.
--
-- Deliberately a SEPARATE table from students (not a column on it) —
-- same reasoning as student_portal_credentials: keeping it on students
-- would risk it riding along on a `select *` (getCurrentStudent does
-- exactly that) and reaching client-side code that has no business
-- seeing it.
--
-- SECURITY TRADE-OFF, spelled out: this token is a bearer credential —
-- anyone who ever obtains the URL (forwarded email, shared inbox,
-- compromised mailbox) gets full, indefinite access to that student's
-- account, no second factor involved. Mitigated only by the token's
-- length/randomness and by admin's ability to regenerate it (rotating
-- the token immediately invalidates the old link).

create table if not exists public.student_portal_access (
  student_id uuid primary key references public.students (id) on delete cascade,
  access_token text not null unique,
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.student_portal_access;
create trigger set_updated_at before update on public.student_portal_access
  for each row execute function public.set_updated_at();

alter table public.student_portal_access enable row level security;

drop policy if exists "student_portal_access_admin_write" on public.student_portal_access;
create policy "student_portal_access_admin_write" on public.student_portal_access
  for all using (public.is_admin()) with check (public.is_admin());

-- No self/anon grant on the table itself — a signed-out visitor resolves
-- their token only through the narrow function below, mirroring the
-- enrollment_recent_duplicate() pattern in 003_enrollments.sql (anon
-- never gets a general SELECT policy on a table with secrets in it).
grant select, insert, update, delete on public.student_portal_access to authenticated;

-- Narrow, anon-callable lookup: token in, {student_id, email, status}
-- out — nothing else about the students table is exposed. Used by
-- src/app/student/access/[token]/route.ts, which is hit by a
-- signed-out browser.
create or replace function public.resolve_portal_access_token(p_token text)
returns table (student_id uuid, email text, status text)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.email, s.status
  from public.students s
  join public.student_portal_access spa on spa.student_id = s.id
  where spa.access_token = p_token;
$$;

grant execute on function public.resolve_portal_access_token(text) to anon, authenticated;
