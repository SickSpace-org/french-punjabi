-- French Punjabi — Enrollment applications (no online payment)
-- Run this once in the Supabase SQL Editor, after 001_schema.sql /
-- 002_seed_data.sql. Safe to re-run (uses if not exists / create or replace).
--
-- Students submit an enrollment application (no payment) which is stored
-- here, shown in Admin → Enrollments, and triggers a confirmation email.
-- The French Punjabi team follows up manually.

-- =========================================================
-- Table
-- =========================================================

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),

  -- Student-submitted contact details
  full_name text not null,
  email text not null,
  phone text not null,
  country text not null,
  current_french_level text,

  -- Foreign keys to the course structure at time of submission. Nullable —
  -- a "Complete Program" / "Redo a Month" application isn't tied to a single
  -- phase/level/batch row (see program_offer_key below), and any of these
  -- can also go null later if the referenced row is ever deleted.
  phase_id uuid references public.phases (id) on delete set null,
  level_id uuid references public.levels (id) on delete set null,
  batch_id uuid references public.batches (id) on delete set null,
  program_offer_key text references public.program_offers (key) on delete set null,

  -- Snapshot of what the student selected, resolved server-side from the
  -- rows above at submission time. Kept even if phase/level/batch_id later
  -- go null (row renamed/removed/timing changed) so the admin can always
  -- see what was originally selected.
  phase_name text not null,
  level_name text,
  batch_timing text not null,

  preferred_contact_method text not null,
  message text,

  status text not null default 'NEW',
  confirmation_email_status text not null default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint enrollments_status_check
    check (status in ('NEW', 'CONTACTED', 'ENROLLED', 'NOT_INTERESTED')),
  constraint enrollments_email_status_check
    check (confirmation_email_status in ('pending', 'sent', 'failed')),
  constraint enrollments_contact_method_check
    check (preferred_contact_method in ('WhatsApp', 'Phone Call', 'Email'))
);

create index if not exists enrollments_status_idx on public.enrollments (status);
create index if not exists enrollments_created_at_idx on public.enrollments (created_at desc);
create index if not exists enrollments_phase_id_idx on public.enrollments (phase_id);
create index if not exists enrollments_level_id_idx on public.enrollments (level_id);
create index if not exists enrollments_batch_id_idx on public.enrollments (batch_id);
create index if not exists enrollments_email_idx on public.enrollments (email);

drop trigger if exists set_updated_at on public.enrollments;
create trigger set_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

-- =========================================================
-- Narrow security-definer helpers
--
-- The public/anon role that submits enrollments must NOT be able to select
-- or update enrollment rows in general (see RLS below — only is_admin() can
-- read/update). These two functions are the only anon-callable exceptions,
-- each intentionally narrow in what it lets an anonymous caller do.
-- =========================================================

-- Lets the submission flow detect an accidental double-submit (double
-- click, retried network request) without granting anon any general SELECT
-- access to the enrollments table.
create or replace function public.enrollment_recent_duplicate(
  p_email text,
  p_batch_id uuid,
  p_program_offer_key text
) returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.enrollments
  where email = p_email
    and batch_id is not distinct from p_batch_id
    and program_offer_key is not distinct from p_program_offer_key
    and created_at > now() - interval '2 minutes'
  order by created_at desc
  limit 1;
$$;

grant execute on function public.enrollment_recent_duplicate(text, uuid, text) to anon, authenticated;

-- Lets the submission flow record whether the confirmation email actually
-- sent, without granting anon any general UPDATE access to the table. Only
-- allows flipping pending -> sent/failed on a just-created row (5 minute
-- window), and only ever touches this one column.
create or replace function public.mark_enrollment_email_status(
  p_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('sent', 'failed') then
    raise exception 'invalid email status: %', p_status;
  end if;

  update public.enrollments
  set confirmation_email_status = p_status
  where id = p_id
    and confirmation_email_status = 'pending'
    and created_at > now() - interval '5 minutes';
end;
$$;

grant execute on function public.mark_enrollment_email_status(uuid, text) to anon, authenticated;

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.enrollments enable row level security;

-- Only admins can browse enrollment applications.
drop policy if exists "enrollments_admin_select" on public.enrollments;
create policy "enrollments_admin_select" on public.enrollments
  for select using (public.is_admin());

-- Anyone (including signed-out visitors) can submit an application, but the
-- row must start life as a fresh, untouched application — this blocks a
-- crafted request from inserting a row with e.g. status = 'ENROLLED'.
drop policy if exists "enrollments_public_insert" on public.enrollments;
create policy "enrollments_public_insert" on public.enrollments
  for insert to anon, authenticated
  with check (status = 'NEW' and confirmation_email_status = 'pending');

-- Only admins can change status (e.g. NEW -> CONTACTED -> ENROLLED).
drop policy if exists "enrollments_admin_update" on public.enrollments;
create policy "enrollments_admin_update" on public.enrollments
  for update using (public.is_admin()) with check (public.is_admin());

-- No delete policy for anyone — enrollments are kept as a permanent record.

grant select on public.enrollments to authenticated;
grant insert on public.enrollments to anon, authenticated;
grant update on public.enrollments to authenticated;
