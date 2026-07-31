-- French Punjabi — Courses admin schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query),
-- before running 002_seed_data.sql.

create extension if not exists "pgcrypto";

-- =========================================================
-- Tables
-- =========================================================

create table if not exists public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.phases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  phase_number int not null,
  code text not null,
  title text not null,
  months_label text not null,
  badge text,
  description text not null,
  display_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  slug text not null unique,
  name text not null,
  subtitle text,
  teacher_name text,
  display_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Leaf table. For Phase 1/2, one row = one selectable timing under a Level
-- (level_id set). For Phase 3, one row = one batch card directly under a
-- Phase (phase_id set) — Phase 3 has no Levels, matching the current site.
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid references public.phases (id) on delete cascade,
  level_id uuid references public.levels (id) on delete cascade,
  slug text unique,
  name text,
  teacher_name text,
  time_label text not null,
  timezone text not null default 'EST',
  note text,
  is_tbd boolean not null default false,
  availability_status text not null default 'available',
  display_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_one_parent check (num_nonnulls(phase_id, level_id) = 1),
  constraint batches_availability_status_check check (
    availability_status in ('available', 'almost_full', 'full', 'hidden')
  )
);

create table if not exists public.pricing (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  payment_mode text not null,
  base_price numeric(10, 2) not null,
  tax_rate numeric(5, 4) not null default 0.13,
  display_total numeric(10, 2) not null,
  currency text not null default 'CAD',
  duration_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_payment_mode_check check (payment_mode in ('full', 'monthly')),
  constraint pricing_phase_mode_unique unique (phase_id, payment_mode)
);

-- Program-wide fees not tied to a single phase: the Complete 7-Month bundle
-- and the Redo-a-Month fee.
create table if not exists public.program_offers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  base_price numeric(10, 2) not null,
  tax_rate numeric(5, 4),
  display_total numeric(10, 2),
  duration_label text,
  currency text not null default 'CAD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint program_offers_key_check check (key in ('complete_program', 'redo_month'))
);

create index if not exists levels_phase_id_idx on public.levels (phase_id);
create index if not exists batches_phase_id_idx on public.batches (phase_id);
create index if not exists batches_level_id_idx on public.batches (level_id);
create index if not exists pricing_phase_id_idx on public.pricing (phase_id);

-- =========================================================
-- updated_at maintenance
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['phases', 'levels', 'batches', 'pricing', 'program_offers'] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- =========================================================
-- Authorization helper — used by every RLS policy below.
-- security definer so it can read admin_users regardless of the
-- caller's own row-level access to that table.
-- =========================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_users where id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.admin_users enable row level security;
alter table public.phases enable row level security;
alter table public.levels enable row level security;
alter table public.batches enable row level security;
alter table public.pricing enable row level security;
alter table public.program_offers enable row level security;

-- admin_users: a signed-in user may only ever see their own row (i.e.
-- "am I an admin"), never enumerate other admins. No insert/update/delete
-- policy exists — that table is only ever managed by the project owner
-- directly in the SQL Editor.
drop policy if exists "admin_users_self_select" on public.admin_users;
create policy "admin_users_self_select" on public.admin_users
  for select using (auth.uid() = id);

-- phases
drop policy if exists "phases_public_select" on public.phases;
create policy "phases_public_select" on public.phases
  for select using (is_active = true or public.is_admin());

drop policy if exists "phases_admin_write" on public.phases;
create policy "phases_admin_write" on public.phases
  for all using (public.is_admin()) with check (public.is_admin());

-- levels
drop policy if exists "levels_public_select" on public.levels;
create policy "levels_public_select" on public.levels
  for select using (is_active = true or public.is_admin());

drop policy if exists "levels_admin_write" on public.levels;
create policy "levels_admin_write" on public.levels
  for all using (public.is_admin()) with check (public.is_admin());

-- batches — publicly visible only when active AND not hidden; admins see all.
drop policy if exists "batches_public_select" on public.batches;
create policy "batches_public_select" on public.batches
  for select using (
    (is_active = true and availability_status <> 'hidden') or public.is_admin()
  );

drop policy if exists "batches_admin_write" on public.batches;
create policy "batches_admin_write" on public.batches
  for all using (public.is_admin()) with check (public.is_admin());

-- pricing
drop policy if exists "pricing_public_select" on public.pricing;
create policy "pricing_public_select" on public.pricing
  for select using (is_active = true or public.is_admin());

drop policy if exists "pricing_admin_write" on public.pricing;
create policy "pricing_admin_write" on public.pricing
  for all using (public.is_admin()) with check (public.is_admin());

-- program_offers
drop policy if exists "program_offers_public_select" on public.program_offers;
create policy "program_offers_public_select" on public.program_offers
  for select using (is_active = true or public.is_admin());

drop policy if exists "program_offers_admin_write" on public.program_offers;
create policy "program_offers_admin_write" on public.program_offers
  for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================
-- Grants — RLS restricts *which rows*; these grant the underlying verbs.
-- Writes are further gated by the admin-only policies above, so granting
-- insert/update/delete to `authenticated` here does not let a non-admin
-- signed-in user write anything.
-- =========================================================

grant usage on schema public to anon, authenticated;

grant select on public.phases, public.levels, public.batches, public.pricing, public.program_offers
  to anon, authenticated;

grant insert, update, delete on public.phases, public.levels, public.batches, public.pricing, public.program_offers
  to authenticated;

grant select on public.admin_users to authenticated;
