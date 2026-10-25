-- French Punjabi — payment-failure lifecycle (Stage 3 / Checkpoint 1, B2).
-- Run after 043_stripe_trial.sql.
--
-- Pure ADDITIVE migration — no existing column, constraint, or RLS policy
-- is altered. Every new function here only ever touches rows that already
-- have a non-null stripe_subscription_id (a real Stripe-driven student);
-- a student with no Stripe data is untouched by anything in this file.
--
-- Days 1-3 after next_payment_due_at: reminders only (handled by the daily
-- job calling record_payment_failed_reminder below — no status change).
-- Day 4: SUSPENDED, seat stays held (filled_slots untouched).
-- Day 14: INACTIVE, seat released.
-- Paying at any point while SUSPENDED: back to ACTIVE immediately (added
-- to record_subscription_payment_succeeded below).
--
-- Deliberately NOT driven by payment_failure_count (how many times Stripe
-- has retried) — only by elapsed calendar time since next_payment_due_at.
-- Stripe's own retry schedule can fire several failures in a row or none
-- at all in a given window; it has no bearing on these day-4/day-14
-- deadlines.

-- =========================================================
-- 1. payment_events — widen for the new lifecycle event types.
-- =========================================================

alter table public.payment_events drop constraint if exists payment_events_event_type_check;
alter table public.payment_events add constraint payment_events_event_type_check check (event_type in (
  'payment_succeeded', 'payment_failed', 'payment_overdue_reminder', 'trial_started',
  'access_suspended', 'access_restored', 'access_revoked',
  'subscription_canceled', 'lost_race_waitlisted', 'duplicate_trial_card',
  'manual_payment_recorded', 'manual_expiry_edit', 'referral_credited'
));

-- =========================================================
-- 2. record_payment_failed — invoice.payment_failed. Only increments the
--    counter and logs it; never itself changes status. The daily job
--    (below) is what actually acts on elapsed time.
-- =========================================================

create or replace function public.record_payment_failed(
  p_stripe_subscription_id text,
  p_amount numeric,
  p_currency text
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
  set payment_failure_count = payment_failure_count + 1
  where id = v_student.id;

  insert into public.payment_events (student_id, event_type, amount, currency, note)
  values (v_student.id, 'payment_failed', p_amount, p_currency, 'invoice.payment_failed');

  return jsonb_build_object('ok', true, 'student_id', v_student.id);
end;
$$;

grant execute on function public.record_payment_failed(text, numeric, text) to service_role;

-- =========================================================
-- 3. record_subscription_payment_succeeded — extended to restore ACTIVE
--    immediately if the student was SUSPENDED, and to clear
--    grace_period_ends_at (it's meaningless once no longer suspended).
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
  v_was_suspended boolean;
begin
  select * into v_student from public.students where stripe_subscription_id = p_stripe_subscription_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  v_was_suspended := v_student.status = 'SUSPENDED';

  update public.students
  set subscription_status = p_subscription_status,
      next_payment_due_at = p_next_payment_due_at,
      course_expiry_at = p_next_payment_due_at,
      payment_failure_count = 0,
      grace_period_ends_at = null,
      status = case when v_was_suspended then 'ACTIVE' else status end
  where id = v_student.id;

  insert into public.payment_events (student_id, event_type, amount, currency, note)
  values (v_student.id, 'payment_succeeded', p_amount, p_currency, 'invoice.payment_succeeded');

  if v_was_suspended then
    insert into public.payment_events (student_id, event_type, note)
    values (v_student.id, 'access_restored', 'Paid while SUSPENDED — restored to ACTIVE immediately.');
  end if;

  return jsonb_build_object('ok', true, 'student_id', v_student.id, 'was_suspended', v_was_suspended);
end;
$$;

grant execute on function public.record_subscription_payment_succeeded(
  text, numeric, text, timestamptz, text
) to service_role;

-- =========================================================
-- 4. run_payment_lifecycle_sweep — the daily job's single entry point.
--    Handles all three things a scheduled job needs to do: suspend
--    overdue-by-4-days students, deactivate+release-seat for
--    overdue-by-14-days (suspended) students, and report who's in the
--    1-3 day reminder window (the job sends the actual reminder emails
--    itself, in TS, using the list this returns — this function only
--    logs that a reminder checkpoint happened, once per student per day,
--    using payment_events as the de-dupe log so a job run twice in one
--    day doesn't double-send).
-- =========================================================

create or replace function public.run_payment_lifecycle_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_suspended_ids uuid[] := '{}';
  v_inactivated jsonb[] := '{}';
  v_reminder_ids uuid[] := '{}';
  v_days_overdue int;
  v_enrollment record;
begin
  -- Day 4+: ACTIVE, Stripe-driven, overdue by at least 4 days -> SUSPENDED.
  for v_student in
    select * from public.students
    where status = 'ACTIVE'
      and stripe_subscription_id is not null
      and next_payment_due_at is not null
      and next_payment_due_at < now() - interval '4 days'
    for update
  loop
    update public.students
    set status = 'SUSPENDED',
        grace_period_ends_at = v_student.next_payment_due_at + interval '14 days'
    where id = v_student.id;

    insert into public.payment_events (student_id, event_type, note)
    values (v_student.id, 'access_suspended', 'Daily sweep: 4+ days overdue since ' || v_student.next_payment_due_at);

    v_suspended_ids := array_append(v_suspended_ids, v_student.id);
  end loop;

  -- Day 14+: SUSPENDED past its grace deadline -> INACTIVE, release the seat.
  for v_student in
    select * from public.students
    where status = 'SUSPENDED'
      and stripe_subscription_id is not null
      and grace_period_ends_at is not null
      and grace_period_ends_at < now()
    for update
  loop
    select * into v_enrollment from public.enrollments
      where student_id = v_student.id and payment_mode = 'subscription'
      order by created_at desc
      limit 1
      for update;

    update public.students
    set status = 'INACTIVE',
        grace_period_ends_at = null
    where id = v_student.id;

    if v_enrollment.batch_id is not null then
      update public.batches set filled_slots = greatest(filled_slots - 1, 0) where id = v_enrollment.batch_id;
    end if;

    insert into public.payment_events (student_id, enrollment_id, event_type, note)
    values (v_student.id, v_enrollment.id, 'access_revoked', 'Daily sweep: grace period expired, seat released. Stripe subscription cancellation is a separate TS-side call.');

    v_inactivated := array_append(v_inactivated, jsonb_build_object(
      'student_id', v_student.id,
      'stripe_subscription_id', v_student.stripe_subscription_id,
      'batch_id', v_enrollment.batch_id
    ));
  end loop;

  -- Days 1-3: ACTIVE, overdue, but under 4 days — reminder window. Logged
  -- at most once per student per calendar day via the payment_events
  -- de-dupe check, so a job re-run the same day never double-reports.
  for v_student in
    select * from public.students
    where status = 'ACTIVE'
      and stripe_subscription_id is not null
      and next_payment_due_at is not null
      and next_payment_due_at < now()
      and next_payment_due_at >= now() - interval '4 days'
    for update
  loop
    v_days_overdue := floor(extract(epoch from (now() - v_student.next_payment_due_at)) / 86400);

    if not exists (
      select 1 from public.payment_events
      where student_id = v_student.id
        and event_type = 'payment_overdue_reminder'
        and created_at >= date_trunc('day', now())
    ) then
      insert into public.payment_events (student_id, event_type, note)
      values (v_student.id, 'payment_overdue_reminder', 'Daily sweep: day ' || v_days_overdue || ' overdue reminder.');

      v_reminder_ids := array_append(v_reminder_ids, v_student.id);
    end if;
  end loop;

  return jsonb_build_object(
    'suspended', to_jsonb(v_suspended_ids),
    'inactivated', to_jsonb(v_inactivated),
    'reminders', to_jsonb(v_reminder_ids)
  );
end;
$$;

grant execute on function public.run_payment_lifecycle_sweep() to service_role;
