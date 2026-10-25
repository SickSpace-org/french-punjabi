-- French Punjabi — Stripe subscription trial logic (Stage 2 of the payments build).
-- Run after 042_stripe_subscription_core.sql.
--
-- Stage 2 scope (A3, per the approved build order): every new subscription
-- signup now starts with a 7-day free trial (card collected upfront, first
-- charge automatic on day 8, then monthly — Stripe's own billing engine
-- drives all of that; nothing here schedules a charge). Adds: the
-- email+card trial-dedupe mechanism (one trial per person, ever — persists
-- even after a student later goes INACTIVE, per the approved decision);
-- recording a successful day-8/renewal payment; and handling an explicit
-- subscription cancellation (including during the trial, before any
-- charge has happened).
--
-- Pricing is UNCHANGED by this migration (see the Stage 1 Q&A) — still
-- reads pricing.display_total as-is, tax question still pending a client
-- decision.

-- =========================================================
-- 1. trial_dedupe_signals — one row per trial ever granted. Never deleted
--    by any student/enrollment cleanup (student_id is on delete SET NULL,
--    not cascade) — this must survive a student going INACTIVE, per the
--    approved decision. email_key has a hard UNIQUE constraint (one trial
--    per email, full stop); card_fingerprint has a partial UNIQUE index
--    (ignores nulls) so two concurrent trial attempts with the same real
--    card can't both slip through a check-then-insert race — enforced by
--    Postgres itself, not just application logic.
-- =========================================================

create table if not exists public.trial_dedupe_signals (
  id                uuid primary key default gen_random_uuid(),
  email_key         text not null unique,
  card_fingerprint  text,
  student_id        uuid references public.students (id) on delete set null,
  created_at        timestamptz not null default now()
);

create unique index if not exists trial_dedupe_signals_card_fingerprint_key
  on public.trial_dedupe_signals (card_fingerprint)
  where card_fingerprint is not null;

alter table public.trial_dedupe_signals enable row level security;

drop policy if exists "trial_dedupe_signals_admin_select" on public.trial_dedupe_signals;
create policy "trial_dedupe_signals_admin_select" on public.trial_dedupe_signals
  for select using (public.is_admin());

-- No anon/authenticated table grants — only reachable via the two
-- security-definer functions below (has_used_trial_email for the
-- pre-checkout read, activate_subscription_enrollment for the write).

-- =========================================================
-- 2. has_used_trial_email — the pre-checkout gate. Called from the public
--    checkout Server Action (anon role) BEFORE any enrollment row or
--    Stripe object is created, so a repeat email is blocked outright, the
--    same way the email half of the dedupe was described in Phase 2.
-- =========================================================

create or replace function public.has_used_trial_email(p_email_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.trial_dedupe_signals where email_key = p_email_key);
$$;

grant execute on function public.has_used_trial_email(text) to anon, authenticated;

-- =========================================================
-- 3. activate_subscription_enrollment — replaced to add the card-fingerprint
--    half of trial dedupe. Email was already checked pre-checkout; this is
--    the "checked within seconds via the webhook, not literally before
--    checkout starts" half described in Phase 2, since hosted Checkout
--    can't expose a card's fingerprint before the session completes.
--
--    If the fingerprint matches a trial already on record (different
--    email, same real card), this does NOT activate the student — it
--    releases the hold exactly like a lost seat-race (no filled_slots
--    increment) and returns reason:'duplicate_trial_card' so the webhook
--    handler cancels the Stripe subscription and tells the student, same
--    shape as the existing lost-race path but a different cause.
-- =========================================================

create or replace function public.activate_subscription_enrollment(
  p_hold_id uuid,
  p_enrollment_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_locked_price numeric,
  p_locked_currency text,
  p_next_payment_due_at timestamptz,
  p_subscription_status text,
  p_is_trial boolean default false,
  p_card_fingerprint text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.batch_seat_holds%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_student_id uuid;
  v_email_key text;
begin
  select * into v_hold from public.batch_seat_holds where id = p_hold_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_hold');
  end if;

  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;

  if not found then
    raise exception 'enrollment % not found', p_enrollment_id;
  end if;

  v_email_key := lower(trim(v_enrollment.email));

  if p_is_trial and p_card_fingerprint is not null
     and exists (select 1 from public.trial_dedupe_signals where card_fingerprint = p_card_fingerprint) then
    -- Same real card already used for a trial under a different email.
    -- Release the hold without ever filling the seat — this signup never
    -- happened as far as capacity/billing are concerned.
    delete from public.batch_seat_holds where id = p_hold_id;
    update public.batches set held_slots = greatest(held_slots - 1, 0) where id = v_hold.batch_id;

    insert into public.payment_events (enrollment_id, event_type, note)
    values (p_enrollment_id, 'duplicate_trial_card', 'Card fingerprint already used for a prior trial under a different email — subscription cancelled, seat released, not activated.');

    return jsonb_build_object('ok', false, 'reason', 'duplicate_trial_card');
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

  if p_is_trial then
    insert into public.trial_dedupe_signals (email_key, card_fingerprint, student_id)
    values (v_email_key, p_card_fingerprint, v_student_id)
    on conflict (email_key) do nothing;
  end if;

  insert into public.payment_events (student_id, enrollment_id, event_type, amount, currency, note)
  values (
    v_student_id, p_enrollment_id,
    case when p_is_trial then 'trial_started' else 'payment_succeeded' end,
    p_locked_price, p_locked_currency,
    case when p_is_trial
      then 'Stage 2: 7-day trial started, card on file, no charge yet'
      else 'Stage 1: first subscription payment at checkout (no trial)'
    end
  );

  return jsonb_build_object('ok', true, 'student_id', v_student_id);
end;
$$;

grant execute on function public.activate_subscription_enrollment(
  uuid, uuid, text, text, numeric, text, timestamptz, text, boolean, text
) to service_role;

-- =========================================================
-- 4. record_subscription_payment_succeeded — the day-8 first charge AND
--    every later monthly renewal both land here via invoice.payment_succeeded
--    (Stripe's billing engine fires the identical event for both; nothing
--    here needs to know which one it is). Resets payment_failure_count to
--    0 defensively, though Stage 3 (B2) is what actually sets it above 0.
-- =========================================================

create or replace function public.record_subscription_payment_succeeded(
  p_stripe_subscription_id text,
  p_amount numeric,
  p_currency text,
  p_next_payment_due_at timestamptz,
  p_subscription_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
begin
  select * into v_student from public.students where stripe_subscription_id = p_stripe_subscription_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  update public.students
  set subscription_status = p_subscription_status,
      next_payment_due_at = p_next_payment_due_at,
      course_expiry_at = p_next_payment_due_at,
      payment_failure_count = 0
  where id = v_student.id;

  insert into public.payment_events (student_id, event_type, amount, currency, note)
  values (v_student.id, 'payment_succeeded', p_amount, p_currency, 'invoice.payment_succeeded');

  return jsonb_build_object('ok', true, 'student_id', v_student.id);
end;
$$;

grant execute on function public.record_subscription_payment_succeeded(
  text, numeric, text, timestamptz, text
) to service_role;

-- =========================================================
-- 5. handle_subscription_canceled — customer.subscription.deleted. Covers
--    both Stage 2's "cancel during the trial" (no charge was ever made)
--    and the general case: access ends, the seat releases immediately.
--    (The Stage-4-approved "keep access until the paid period ends"
--    Customer Portal behavior is a UI-level choice about WHEN this event
--    fires, not about what this handler does once it does.)
-- =========================================================

create or replace function public.handle_subscription_canceled(
  p_stripe_subscription_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_enrollment public.enrollments%rowtype;
begin
  select * into v_student from public.students where stripe_subscription_id = p_stripe_subscription_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  select * into v_enrollment from public.enrollments
    where student_id = v_student.id and payment_mode = 'subscription'
    order by created_at desc
    limit 1
    for update;

  update public.students
  set status = 'INACTIVE',
      subscription_status = 'canceled'
  where id = v_student.id;

  if v_enrollment.batch_id is not null then
    update public.batches set filled_slots = greatest(filled_slots - 1, 0) where id = v_enrollment.batch_id;
  end if;

  insert into public.payment_events (student_id, enrollment_id, event_type, note)
  values (v_student.id, v_enrollment.id, 'subscription_canceled', 'customer.subscription.deleted — seat released');

  return jsonb_build_object('ok', true, 'student_id', v_student.id, 'batch_id', v_enrollment.batch_id);
end;
$$;

grant execute on function public.handle_subscription_canceled(text) to service_role;

-- =========================================================
-- 6. payment_events — widen the event_type check constraint for the two
--    new values used above.
-- =========================================================

alter table public.payment_events drop constraint if exists payment_events_event_type_check;
alter table public.payment_events add constraint payment_events_event_type_check check (event_type in (
  'payment_succeeded', 'payment_failed', 'trial_started',
  'access_suspended', 'access_restored', 'access_revoked',
  'subscription_canceled', 'lost_race_waitlisted', 'duplicate_trial_card',
  'manual_payment_recorded', 'manual_expiry_edit', 'referral_credited'
));
