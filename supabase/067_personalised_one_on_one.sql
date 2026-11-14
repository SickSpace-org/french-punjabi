-- French Punjabi — Personalised one-on-one batch ($399/month, a private batch of one student).
-- Run this once in the Supabase SQL Editor, after 066_assignments.sql.
--
-- How the feature fits the existing system
--   * A one-on-one slot is an ordinary batch under a real phase (Phase 1, 2 or 3)
--     with total_slots = 1, flagged is_one_on_one = true. Because it IS a batch,
--     enrollment, Interac payment confirmation, students, attendance, the teacher
--     dashboard and the student portal all work for it unchanged.
--   * The flag keeps slots out of the phase's normal group-batch timings. They show
--     in their own "Personalised one-on-one" section on each phase page and on
--     /courses/personalised-one-on-one.
--   * Price ($399/month) lives in program_offers under a new key, so it is editable
--     in Admin -> Courses -> Program offers and is the same for every phase.
--   * When a phase has no open slot, visitors leave their details in
--     one_on_one_notify and are emailed when an admin opens slots for that phase.
--
-- It also retires the old Calendly "One-on-one" offer by switching it off. The row
-- is kept (not deleted) so enrollments recorded against it keep their history.
--
-- Safe to re-run.

-- 1. Flag one-on-one slots.
alter table public.batches add column if not exists is_one_on_one boolean not null default false;

create index if not exists batches_one_on_one_idx on public.batches (phase_id) where is_one_on_one;

-- 2. New program offer key + the $399 price.
alter table public.program_offers drop constraint if exists program_offers_key_check;
alter table public.program_offers add constraint program_offers_key_check
  check (key in ('complete_program', 'redo_month', 'one_on_one_testing', 'personalised_one_on_one'));

insert into public.program_offers (key, label, base_price, tax_rate, display_total, duration_label, is_active)
values ('personalised_one_on_one', 'Personalised One-on-One', 399.00, 0, 399.00, 'Private batch', true)
on conflict (key) do nothing;

update public.program_offers set is_active = false where key = 'one_on_one_testing';

-- 3. "Notify me when the next one-on-one batch opens", per phase.
create table if not exists public.one_on_one_notify (
  id           uuid primary key default gen_random_uuid(),
  phase_id     uuid not null references public.phases (id) on delete cascade,
  full_name    text not null,
  email        text not null,
  phone        text not null,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- One request per email per phase — signing up again is a no-op.
create unique index if not exists one_on_one_notify_phase_email_key
  on public.one_on_one_notify (phase_id, lower(email));

create index if not exists one_on_one_notify_pending_idx
  on public.one_on_one_notify (phase_id) where notified_at is null;

alter table public.one_on_one_notify enable row level security;

-- Anyone can ask to be notified, but only as a fresh, un-notified row.
drop policy if exists "one_on_one_notify_public_insert" on public.one_on_one_notify;
create policy "one_on_one_notify_public_insert" on public.one_on_one_notify
  for insert to anon, authenticated
  with check (notified_at is null);

drop policy if exists "one_on_one_notify_admin_select" on public.one_on_one_notify;
create policy "one_on_one_notify_admin_select" on public.one_on_one_notify
  for select using (public.is_admin());

drop policy if exists "one_on_one_notify_admin_update" on public.one_on_one_notify;
create policy "one_on_one_notify_admin_update" on public.one_on_one_notify
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "one_on_one_notify_admin_delete" on public.one_on_one_notify;
create policy "one_on_one_notify_admin_delete" on public.one_on_one_notify
  for delete using (public.is_admin());

grant insert on public.one_on_one_notify to anon, authenticated;
grant select, update, delete on public.one_on_one_notify to authenticated;
