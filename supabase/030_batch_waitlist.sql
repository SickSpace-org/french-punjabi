-- French Punjabi — "Notify me when a seat opens" for full batches.
-- Run this once in the Supabase SQL Editor, after 029_one_on_one_hourly.sql.
--
-- A student who clicks a full batch timing leaves their details here. When
-- an admin later frees a seat in that batch (Admin → Courses), everyone
-- still waiting is emailed once and `notified_at` is stamped.

create table if not exists public.batch_waitlist (
  id           uuid primary key default gen_random_uuid(),
  batch_id     uuid not null references public.batches (id) on delete cascade,
  full_name    text not null,
  email        text not null,
  phone        text not null,
  message      text,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- One waiting spot per email per batch — a second sign-up is a no-op.
create unique index if not exists batch_waitlist_batch_email_key
  on public.batch_waitlist (batch_id, lower(email));

create index if not exists batch_waitlist_pending_idx
  on public.batch_waitlist (batch_id) where notified_at is null;

alter table public.batch_waitlist enable row level security;

-- Anyone can join a waitlist, but only as a fresh, un-notified row.
drop policy if exists "batch_waitlist_public_insert" on public.batch_waitlist;
create policy "batch_waitlist_public_insert" on public.batch_waitlist
  for insert to anon, authenticated
  with check (notified_at is null);

drop policy if exists "batch_waitlist_admin_select" on public.batch_waitlist;
create policy "batch_waitlist_admin_select" on public.batch_waitlist
  for select using (public.is_admin());

drop policy if exists "batch_waitlist_admin_update" on public.batch_waitlist;
create policy "batch_waitlist_admin_update" on public.batch_waitlist
  for update using (public.is_admin()) with check (public.is_admin());

-- Admins can remove someone from a waitlist (Admin → Waitlist).
drop policy if exists "batch_waitlist_admin_delete" on public.batch_waitlist;
create policy "batch_waitlist_admin_delete" on public.batch_waitlist
  for delete using (public.is_admin());

grant insert on public.batch_waitlist to anon, authenticated;
grant select, update, delete on public.batch_waitlist to authenticated;
