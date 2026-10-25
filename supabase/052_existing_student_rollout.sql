-- French Punjabi — Checkpoint 3, Phase 3: existing-student rollout gates.
--
-- PLAIN LANGUAGE: pure addition — one new tiny settings table (one row,
-- holds the global switch), one new column on students (the per-student
-- switch, defaults false for every existing row), and one read-only
-- helper function. No existing column, constraint, RLS policy, or
-- function is touched. By itself this file changes nothing's behavior —
-- nothing anywhere in the codebase reads existing_lifecycle_enabled or
-- app_config yet; that only starts once the daily job is explicitly
-- extended to use them (a separate, later change, not in this file).
-- Safe to re-run.
--
-- Three gates, ALL required before any AUTOMATED contact (reminder,
-- suspend, or inactive) ever touches an existing student:
--   1. app_config.existing_student_rollout is NOT 'off' ('per_student' or
--      'all')
--   2. if 'per_student': students.existing_lifecycle_enabled is true for
--      THAT student ('all' skips this check — every eligible student
--      qualifies)
--   3. students.next_payment_due is set (admin-verified, never guessed —
--      see migration 015 / 050)
-- Staged rollout (you only, one test student, one batch, then everyone)
-- happens entirely through gate 2 while staying in 'per_student' —
-- enable one student at a time, or bulk-enable a batch — then flip gate 1
-- to 'all' only once satisfied. Admin's own manual actions (recording a
-- payment, editing a student directly) are NEVER gated by any of this —
-- these three gates are specifically about AUTOMATED contact.

create table if not exists public.app_config (
  id text primary key default 'singleton',
  existing_student_rollout text not null default 'off',
  updated_at timestamptz not null default now(),
  constraint app_config_singleton check (id = 'singleton'),
  constraint app_config_rollout_check check (existing_student_rollout in ('off', 'per_student', 'all'))
);

insert into public.app_config (id) values ('singleton') on conflict (id) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "app_config_admin_select" on public.app_config;
create policy "app_config_admin_select" on public.app_config
  for select using (public.is_admin());

drop policy if exists "app_config_admin_write" on public.app_config;
create policy "app_config_admin_write" on public.app_config
  for update using (public.is_admin()) with check (public.is_admin());

alter table public.students add column if not exists existing_lifecycle_enabled boolean not null default false;

-- =========================================================
-- existing_student_lifecycle_eligible — the one place all three gates are
-- evaluated, so the digest, the (future) daily job, and the announcement
-- all agree on the exact same definition of "eligible" by construction
-- rather than three separately-written copies drifting apart.
-- =========================================================

create or replace function public.existing_student_lifecycle_eligible(p_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_rollout text;
  v_student public.students%rowtype;
  v_payment_mode text;
begin
  select existing_student_rollout into v_rollout from public.app_config where id = 'singleton';
  if v_rollout is null or v_rollout = 'off' then
    return false;
  end if;

  select * into v_student from public.students where id = p_student_id;
  if not found then
    return false;
  end if;
  if v_student.stripe_subscription_id is not null then
    return false; -- Stripe-managed students use the real Stripe lifecycle, not this
  end if;
  if v_student.next_payment_due is null then
    return false;
  end if;
  if v_rollout = 'per_student' and not v_student.existing_lifecycle_enabled then
    return false;
  end if;

  -- Defense in depth: the admin billing UI already refuses to let a
  -- 'full' or unclassified student get this far (no due-date editor shown
  -- for them, enable checkbox disabled) — but this function is the real
  -- authorization boundary, not the UI, so it re-checks the same rule
  -- directly rather than trusting the UI never to have a gap or a future
  -- caller that skips it. Looks at the MOST RECENT enrollment, same
  -- "latest enrollment wins" rule the rest of this feature uses.
  select payment_mode into v_payment_mode from public.enrollments
    where student_id = p_student_id
    order by created_at desc
    limit 1;
  if v_payment_mode is distinct from 'monthly' then
    return false;
  end if;

  return true;
end;
$$;

grant execute on function public.existing_student_lifecycle_eligible(uuid) to authenticated, service_role;
