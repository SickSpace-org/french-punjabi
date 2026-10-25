-- French Punjabi — Stripe subscription core (Stage 1 of the payments build).
-- Run after 041_student_support_tickets.sql.
--
-- Stage 1 scope only: schema for the new recurring-subscription signup path,
-- the atomic seat-reservation + short hold mechanism (B1), and the Terms
-- acceptance gate (A7). Trial logic (A3), the suspend/inactive lifecycle
-- (B2), the subscription page (B3), and referrals/promos/wallets (A4-A6/A8)
-- are later stages and intentionally have no schema here yet.
--
-- Reuses the EXISTING enrollments -> students pipeline rather than creating
-- a parallel one: a Stripe subscription signup creates an `enrollments` row
-- exactly like the Interac flow does (status NEW, payment_status PENDING),
-- and `activate_subscription_enrollment()` below is the Stripe-driven analog
-- of `confirm_enrollment_payment()`, mirroring its exact row-lock + idempotent
-- upsert-by-email shape. students.enrollment_id keeps meaning "first
-- enrollment"; a person's Stripe fields live on `students` (one global
-- account, one active subscription at a time), matching how
-- is_active_student() already gates ALL course content globally per
-- 010_simplify_access_to_enrolled.sql.

-- =========================================================
-- 1. enrollments.payment_mode — new 'subscription' value. Does NOT touch
--    the existing 'full'/'monthly' Interac-installment semantics.
-- =========================================================

alter table public.enrollments drop constraint if exists enrollments_payment_mode_check;
alter table public.enrollments add constraint enrollments_payment_mode_check
  check (payment_mode is null or payment_mode in ('full', 'monthly', 'subscription'));

-- =========================================================
-- 2. batches — total_slots/filled_slots have existed live since before this
--    migration history (confirmed via direct query; no prior migration file
--    ever created them — see the Phase 1 audit). Codified here as
--    `if not exists` so a fresh database matches production, and so this
--    migration can add `held_slots` for the new short seat-hold mechanism.
-- =========================================================

alter table public.batches add column if not exists total_slots int;
alter table public.batches add column if not exists filled_slots int not null default 0;
alter table public.batches add column if not exists held_slots int not null default 0;

-- =========================================================
-- 3. students — Stripe/subscription fields. subscription_status mirrors
--    Stripe's own state (trialing/active/past_due/canceled/incomplete) and
--    is informational only; `status` (ACTIVE/INACTIVE/SUSPENDED) stays the
--    one real access gate, unchanged by this migration.
-- =========================================================

alter table public.students add column if not exists stripe_customer_id text;
alter table public.students add column if not exists stripe_subscription_id text;
alter table public.students add column if not exists subscription_status text;
alter table public.students add column if not exists locked_price numeric(10, 2);
alter table public.students add column if not exists locked_currency text;
alter table public.students add column if not exists next_payment_due_at timestamptz;
alter table public.students add column if not exists course_expiry_at timestamptz;
alter table public.students add column if not exists payment_failure_count int not null default 0;
alter table public.students add column if not exists grace_period_ends_at timestamptz;

alter table public.students drop constraint if exists students_stripe_customer_id_key;
alter table public.students add constraint students_stripe_customer_id_key unique (stripe_customer_id);

alter table public.students drop constraint if exists students_stripe_subscription_id_key;
alter table public.students add constraint students_stripe_subscription_id_key unique (stripe_subscription_id);

-- =========================================================
-- 4. stripe_webhook_events — idempotency ledger. The webhook handler's
--    first act is inserting the Stripe event id here; a primary-key
--    violation on a second delivery means "already processed", and the
--    handler returns 200 without touching anything else.
-- =========================================================

create table if not exists public.stripe_webhook_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "stripe_webhook_events_admin_select" on public.stripe_webhook_events;
create policy "stripe_webhook_events_admin_select" on public.stripe_webhook_events
  for select using (public.is_admin());

-- No anon/authenticated grants at all — only the service-role webhook
-- handler ever touches this table, and service_role bypasses RLS/grants.

-- =========================================================
-- 5. payment_events — permanent audit log, same role as
--    teacher_content_audit/batch_change_history elsewhere in this app.
--    Either student_id or enrollment_id is set (enrollment_id alone covers
--    the lost-race case, where no student row is ever created).
-- =========================================================

create table if not exists public.payment_events (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid references public.students (id) on delete set null,
  enrollment_id      uuid references public.enrollments (id) on delete set null,
  event_type        text not null,
  amount            numeric(10, 2),
  currency          text,
  stripe_event_id   text references public.stripe_webhook_events (id) on delete set null,
  created_by        uuid references public.admin_users (id) on delete set null,
  note              text,
  created_at        timestamptz not null default now(),
  constraint payment_events_event_type_check check (event_type in (
    'payment_succeeded', 'payment_failed', 'trial_started',
    'access_suspended', 'access_restored', 'access_revoked',
    'subscription_canceled', 'lost_race_waitlisted',
    'manual_payment_recorded', 'manual_expiry_edit', 'referral_credited'
  ))
);

create index if not exists payment_events_student_id_idx on public.payment_events (student_id);
create index if not exists payment_events_created_at_idx on public.payment_events (created_at desc);

alter table public.payment_events enable row level security;

drop policy if exists "payment_events_admin_select" on public.payment_events;
create policy "payment_events_admin_select" on public.payment_events
  for select using (public.is_admin());

-- =========================================================
-- 6. batch_seat_holds — short (~30 min) provisional reservation created at
--    checkout start, converted to a real filled_slots seat on
--    checkout.session.completed, or released on checkout.session.expired.
--    Nothing outside the two security-definer functions below ever
--    touches this table, so RLS has no insert/update/delete policy at all.
-- =========================================================

create table if not exists public.batch_seat_holds (
  id              uuid primary key,
  batch_id        uuid not null references public.batches (id) on delete cascade,
  enrollment_id   uuid not null references public.enrollments (id) on delete cascade,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index if not exists batch_seat_holds_batch_id_idx on public.batch_seat_holds (batch_id);

alter table public.batch_seat_holds enable row level security;

drop policy if exists "batch_seat_holds_admin_select" on public.batch_seat_holds;
create policy "batch_seat_holds_admin_select" on public.batch_seat_holds
  for select using (public.is_admin());

-- =========================================================
-- 7. terms_versions / terms_acceptances (A7). Two tables, not a flat
--    version column on the acceptance row, so a future legal-text edit
--    never rewrites what a past acceptance actually pointed at. Real
--    legal text is still pending from the client (see the Phase 2 open
--    items) — seeded below with an explicit placeholder, not real terms.
-- =========================================================

create table if not exists public.terms_versions (
  id            uuid primary key default gen_random_uuid(),
  version       text not null unique,
  body_text     text not null,
  effective_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table if not exists public.terms_acceptances (
  id                 uuid primary key default gen_random_uuid(),
  enrollment_id      uuid not null unique references public.enrollments (id) on delete cascade,
  terms_version_id   uuid not null references public.terms_versions (id),
  accepted_at        timestamptz not null default now(),
  ip_address         inet
);

insert into public.terms_versions (version, body_text)
values (
  'placeholder-2026-stage1',
  'PLACEHOLDER — real Terms & Services / refund-policy wording is pending from the client (see Phase 2 open items). This text exists only so Stage 1''s checkout gate has a real row to point at.'
)
on conflict (version) do nothing;

alter table public.terms_versions enable row level security;
alter table public.terms_acceptances enable row level security;

drop policy if exists "terms_versions_public_select" on public.terms_versions;
create policy "terms_versions_public_select" on public.terms_versions
  for select using (true);

drop policy if exists "terms_versions_admin_write" on public.terms_versions;
create policy "terms_versions_admin_write" on public.terms_versions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "terms_acceptances_public_insert" on public.terms_acceptances;
create policy "terms_acceptances_public_insert" on public.terms_acceptances
  for insert to anon, authenticated
  with check (true);

drop policy if exists "terms_acceptances_admin_select" on public.terms_acceptances;
create policy "terms_acceptances_admin_select" on public.terms_acceptances
  for select using (public.is_admin());

grant select on public.terms_versions to anon, authenticated;
grant insert on public.terms_acceptances to anon, authenticated;

-- =========================================================
-- 8. reserve_batch_seat — the atomic hold. Row-locks the batch exactly like
--    confirm_enrollment_payment() locks the enrollment, so two concurrent
--    callers for the last seat are genuinely serialized by Postgres, not by
--    application logic. Called from the public checkout Server Action
--    (anon role), before any Stripe API call — a full batch is rejected
--    before the student ever reaches Stripe.
-- =========================================================

create or replace function public.reserve_batch_seat(
  p_batch_id uuid,
  p_enrollment_id uuid,
  p_hold_id uuid,
  p_hold_minutes int default 30
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
  v_expires_at timestamptz := now() + (p_hold_minutes || ' minutes')::interval;
begin
  select * into v_batch from public.batches where id = p_batch_id for update;

  if not found then
    raise exception 'batch % not found', p_batch_id;
  end if;

  if v_batch.total_slots is not null
     and v_batch.filled_slots + v_batch.held_slots >= v_batch.total_slots then
    return jsonb_build_object('ok', false, 'reason', 'full');
  end if;

  insert into public.batch_seat_holds (id, batch_id, enrollment_id, expires_at)
  values (p_hold_id, p_batch_id, p_enrollment_id, v_expires_at);

  update public.batches set held_slots = held_slots + 1 where id = p_batch_id;

  return jsonb_build_object('ok', true, 'hold_id', p_hold_id, 'expires_at', v_expires_at);
end;
$$;

grant execute on function public.reserve_batch_seat(uuid, uuid, uuid, int) to anon, authenticated;

-- =========================================================
-- 9. release_batch_seat_hold — called from the webhook on
--    checkout.session.expired. Idempotent: a hold already consumed by
--    activate_subscription_enrollment() (or already released) is a no-op.
-- =========================================================

create or replace function public.release_batch_seat_hold(p_hold_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.batch_seat_holds%rowtype;
begin
  select * into v_hold from public.batch_seat_holds where id = p_hold_id for update;

  if not found then
    return;
  end if;

  delete from public.batch_seat_holds where id = p_hold_id;
  update public.batches set held_slots = greatest(held_slots - 1, 0) where id = v_hold.batch_id;
end;
$$;

-- Granted to anon too: the checkout Server Action calls this itself to
-- release a hold immediately if Stripe session creation fails after the
-- reservation succeeded (rather than leaving it to expire in 30 min). Safe
-- to expose — it only deletes a hold the caller must already know the id
-- of (never shown to the browser) and decrements a counter, nothing else.
grant execute on function public.release_batch_seat_hold(uuid) to service_role, anon, authenticated;

-- =========================================================
-- 10. activate_subscription_enrollment — the Stripe-driven analog of
--     confirm_enrollment_payment(). Called only from the webhook handler
--     (service-role client) on checkout.session.completed. Returns
--     ok:false, reason:'no_hold' if the hold is missing — the lost-race
--     path decision 2 describes; the webhook handler reacts to that by
--     cancelling/refunding the Stripe subscription and waitlisting the
--     student, never by billing someone for a seat they don't have.
-- =========================================================

create or replace function public.activate_subscription_enrollment(
  p_hold_id uuid,
  p_enrollment_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_locked_price numeric,
  p_locked_currency text,
  p_next_payment_due_at timestamptz,
  p_subscription_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.batch_seat_holds%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_student_id uuid;
begin
  select * into v_hold from public.batch_seat_holds where id = p_hold_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_hold');
  end if;

  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;

  if not found then
    raise exception 'enrollment % not found', p_enrollment_id;
  end if;

  if v_enrollment.payment_status <> 'PAID' then
    update public.enrollments
    set payment_status = 'PAID',
        status = 'ENROLLED',
        paid_at = now()
    where id = p_enrollment_id
    returning * into v_enrollment;
  end if;

  insert into public.students (
    enrollment_id, full_name, email, phone, country, enrollment_ref,
    stripe_customer_id, stripe_subscription_id, subscription_status,
    locked_price, locked_currency, next_payment_due_at
  )
  values (
    v_enrollment.id, v_enrollment.full_name, v_enrollment.email, v_enrollment.phone,
    v_enrollment.country, v_enrollment.enrollment_ref,
    p_stripe_customer_id, p_stripe_subscription_id, p_subscription_status,
    p_locked_price, p_locked_currency, p_next_payment_due_at
  )
  on conflict (email_key) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        country = excluded.country,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        subscription_status = excluded.subscription_status,
        locked_price = excluded.locked_price,
        locked_currency = excluded.locked_currency,
        next_payment_due_at = excluded.next_payment_due_at
  returning id into v_student_id;

  update public.enrollments set student_id = v_student_id where id = p_enrollment_id;

  delete from public.batch_seat_holds where id = p_hold_id;

  update public.batches
  set held_slots = greatest(held_slots - 1, 0),
      filled_slots = filled_slots + 1
  where id = v_hold.batch_id;

  insert into public.payment_events (student_id, enrollment_id, event_type, amount, currency, note)
  values (
    v_student_id, p_enrollment_id, 'payment_succeeded', p_locked_price, p_locked_currency,
    'Stage 1: first subscription payment at checkout (no trial in Stage 1)'
  );

  return jsonb_build_object('ok', true, 'student_id', v_student_id);
end;
$$;

grant execute on function public.activate_subscription_enrollment(
  uuid, uuid, text, text, numeric, text, timestamptz, text
) to service_role;
