-- French Punjabi — Checkpoint 3, Phase 4: the two existing-student payment
-- paths ("Pay this month" one-time, "Set up autopay" recurring).
--
-- PLAIN LANGUAGE: pure addition — two new functions, no existing column,
-- constraint, RLS policy, or function is touched. Both are service_role-
-- only (called exclusively from the Stripe webhook route after Stripe
-- itself has already confirmed a real payment/subscription), and both
-- refuse to act on anyone who already has a stripe_subscription_id, so
-- this cannot double-attach Stripe to a student or touch a Stripe-managed
-- one. Safe to re-run.
--
--   1. record_existing_student_stripe_payment — the "Pay this month"
--      success path. Same settlement core as the admin's manual-payment
--      recording (settle_existing_student_payment, migration 051) — one
--      shared implementation for "this student's overdue was just
--      cleared," regardless of whether admin typed it in or Stripe
--      confirmed it.
--   0. Widens payment_events_event_type_check (a CHECK constraint this
--      project itself introduced) to add 'autopay_set_up' — none of the
--      existing values accurately describe "a recurring Stripe
--      subscription was attached, no payment has happened yet." Also
--      widens payment_notifications' kind check (migration 048) to add
--      'existing_student_payment_available' for the announcement
--      (item 7), and adds students.existing_lifecycle_announced_at so
--      that announcement is sent at most once per student, ever.
--
--   2. attach_stripe_to_existing_student — the "Set up autopay" success
--      path. Does NOT settle anything (no payment has happened yet at
--      this point — the first charge is deliberately delayed to the
--      student's existing next_payment_due via billing_cycle_anchor, see
--      the Phase 4 build notes). Only attaches the new Stripe IDs. From
--      their actual first charge onward, this student is handled by the
--      exact same Stripe lifecycle every Stripe-subscribed student
--      already uses (handleInvoicePaymentSucceeded etc.) — nothing
--      special needed for them going forward.

alter table public.payment_events drop constraint if exists payment_events_event_type_check;
alter table public.payment_events add constraint payment_events_event_type_check check (event_type in (
  'payment_succeeded', 'payment_failed', 'payment_overdue_reminder', 'trial_started', 'trial_ending',
  'access_suspended', 'access_restored', 'access_revoked',
  'subscription_canceled', 'lost_race_waitlisted', 'duplicate_trial_card',
  'charge_refunded', 'charge_disputed', 'reconciliation_mismatch',
  'manual_payment_recorded', 'manual_expiry_edit', 'referral_credited', 'referral_reversed',
  'autopay_set_up'
));

alter table public.payment_notifications drop constraint if exists payment_notifications_kind_check;
alter table public.payment_notifications add constraint payment_notifications_kind_check check (kind in (
  'payment_succeeded', 'payment_failed', 'renewal_upcoming',
  'trial_ending', 'access_suspended', 'access_revoked', 'referral_reward',
  'existing_student_payment_available'
));

alter table public.students add column if not exists existing_lifecycle_announced_at timestamptz;

create or replace function public.record_existing_student_stripe_payment(
  p_student_id uuid,
  p_amount numeric,
  p_currency text,
  p_stripe_checkout_session_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.settle_existing_student_payment(
    p_student_id, p_amount, p_currency, 'payment_succeeded',
    'Existing-student "Pay this month" — Stripe checkout ' || p_stripe_checkout_session_id,
    null
  );
end;
$$;

grant execute on function public.record_existing_student_stripe_payment(uuid, numeric, text, text) to service_role;

create or replace function public.attach_stripe_to_existing_student(
  p_student_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_subscription_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
begin
  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;
  if v_student.stripe_subscription_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_stripe_managed');
  end if;

  update public.students
  set stripe_customer_id = p_stripe_customer_id,
      stripe_subscription_id = p_stripe_subscription_id,
      subscription_status = p_subscription_status
  where id = p_student_id;

  insert into public.payment_events (student_id, event_type, note)
  values (p_student_id, 'autopay_set_up', 'Existing student set up autopay — Stripe subscription ' || p_stripe_subscription_id || ' attached, first charge delayed to their existing due date.');

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.attach_stripe_to_existing_student(uuid, text, text, text) to service_role;
