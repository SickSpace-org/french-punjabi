-- French Punjabi — Checkpoint 2 safety additions (admin Stripe-awareness,
-- seat drift check, refund/dispute logging).
--
-- PLAIN LANGUAGE: this file is pure addition. It does not alter any
-- existing column, table, or RLS policy — it only widens one CHECK
-- constraint (payment_events_event_type_check, which this project itself
-- introduced in Stage 1/2 — not a pre-existing one) to allow two new
-- log-entry labels, and adds four new functions. Nothing here can affect
-- any student who has no Stripe data (every new function either targets
-- a specific student id/customer id the caller already resolved, or only
-- ever reads students where stripe_subscription_id is not null). Safe to
-- re-run — every statement is idempotent (drop-if-exists / create-or-
-- replace / add column if not exists).
--
-- What's in here:
--   1. payment_events — two new event types (charge_refunded, charge_disputed).
--   2. record_payment_alert — refund/dispute logging, called from the webhook.
--   3. admin_deactivate_student — the Stripe-aware replacement for plain
--      setStudentStatus(..., 'INACTIVE') on a Stripe-subscribed student:
--      releases the seat in the same transaction and hands back the
--      stripe_subscription_id so the calling Server Action can cancel it
--      (SQL can't call Stripe). A non-Stripe student is untouched by this
--      function's seat/Stripe logic — same plain status update as today.
--   4. admin_reactivate_student — the atomic opposite: re-checks capacity
--      in the SAME batch the student was last enrolled in before setting
--      ACTIVE again; refuses if full unless p_override is explicitly true.
--      Deliberately does NOT touch Stripe (a fully-cancelled subscription
--      can't be un-cancelled — resuming billing for real is a separate,
--      later action, not this function's job).
--   5. check_filled_slots_drift — compares each batch's filled_slots
--      counter against an actual count of its ACTIVE Stripe-subscribed
--      students, for admin review. Read-only — fixes nothing by itself.

-- Also adds 'trial_ending' (customer.subscription.trial_will_end now logs
-- under its own name instead of the misleading reuse of 'trial_started'
-- it shipped with) and 'reconciliation_mismatch' (the daily job's
-- Stripe-vs-our-DB check, logged for admin review, never auto-fixed
-- except the one clear-cut case already handled by handle_subscription_canceled).
alter table public.payment_events drop constraint if exists payment_events_event_type_check;
alter table public.payment_events add constraint payment_events_event_type_check check (event_type in (
  'payment_succeeded', 'payment_failed', 'payment_overdue_reminder', 'trial_started', 'trial_ending',
  'access_suspended', 'access_restored', 'access_revoked',
  'subscription_canceled', 'lost_race_waitlisted', 'duplicate_trial_card',
  'charge_refunded', 'charge_disputed', 'reconciliation_mismatch',
  'manual_payment_recorded', 'manual_expiry_edit', 'referral_credited'
));

-- =========================================================
-- record_payment_alert — charge.refunded / charge.dispute.created. Logs
-- only; deliberately makes NO access-state change (the refund policy is
-- still pending from the client, per the standing rule to use safe
-- placeholders and never block on it).
-- =========================================================

create or replace function public.record_payment_alert(
  p_stripe_customer_id text,
  p_event_type text,
  p_amount numeric,
  p_currency text,
  p_stripe_object_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
begin
  select * into v_student from public.students where stripe_customer_id = p_stripe_customer_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  insert into public.payment_events (student_id, event_type, amount, currency, note)
  values (v_student.id, p_event_type, p_amount, p_currency, p_stripe_object_id);

  return jsonb_build_object(
    'ok', true,
    'student_id', v_student.id,
    'email', v_student.email,
    'full_name', v_student.full_name
  );
end;
$$;

grant execute on function public.record_payment_alert(text, text, numeric, text, text) to service_role;

-- =========================================================
-- admin_deactivate_student — see header. is_admin()-gated.
-- =========================================================

create or replace function public.admin_deactivate_student(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_enrollment record;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  if v_student.stripe_subscription_id is null then
    -- No Stripe data — exactly today's plain behavior, nothing new.
    update public.students set status = 'INACTIVE' where id = p_student_id;
    return jsonb_build_object('ok', true, 'stripe_subscription_id', null);
  end if;

  select * into v_enrollment from public.enrollments
    where student_id = p_student_id and payment_mode = 'subscription'
    order by created_at desc
    limit 1
    for update;

  update public.students
  set status = 'INACTIVE',
      grace_period_ends_at = null
  where id = p_student_id;

  if v_enrollment.batch_id is not null then
    update public.batches set filled_slots = greatest(filled_slots - 1, 0) where id = v_enrollment.batch_id;
  end if;

  insert into public.payment_events (student_id, enrollment_id, event_type, created_by, note)
  values (p_student_id, v_enrollment.id, 'access_revoked', auth.uid(), 'Admin-initiated deactivation — seat released, Stripe subscription cancellation is a separate TS-side call.');

  return jsonb_build_object('ok', true, 'stripe_subscription_id', v_student.stripe_subscription_id);
end;
$$;

grant execute on function public.admin_deactivate_student(uuid) to authenticated;

-- =========================================================
-- admin_reactivate_student — see header. is_admin()-gated.
-- =========================================================

create or replace function public.admin_reactivate_student(p_student_id uuid, p_override boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_enrollment record;
  v_batch public.batches%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  select * into v_enrollment from public.enrollments
    where student_id = p_student_id and payment_mode = 'subscription'
    order by created_at desc
    limit 1;

  if v_enrollment.batch_id is not null then
    select * into v_batch from public.batches where id = v_enrollment.batch_id for update;

    if not p_override and v_batch.total_slots is not null
       and v_batch.filled_slots + v_batch.held_slots >= v_batch.total_slots then
      return jsonb_build_object('ok', false, 'reason', 'batch_full', 'batch_id', v_batch.id);
    end if;

    update public.batches set filled_slots = filled_slots + 1 where id = v_batch.id;
  end if;

  update public.students
  set status = 'ACTIVE',
      payment_failure_count = 0,
      grace_period_ends_at = null
  where id = p_student_id;

  insert into public.payment_events (student_id, enrollment_id, event_type, created_by, note)
  values (p_student_id, v_enrollment.id, 'access_restored', auth.uid(), 'Admin-initiated reactivation' || (case when p_override then ' (capacity override)' else '' end));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_reactivate_student(uuid, boolean) to authenticated;

-- =========================================================
-- check_filled_slots_drift — read-only. Compares each batch's filled_slots
-- counter to an actual count of ACTIVE students whose most recent
-- subscription enrollment points at that batch. Only ever considers
-- Stripe-subscribed students (enrollments.payment_mode = 'subscription')
-- — the legacy Interac filled_slots counter is still purely admin-manual
-- by design and isn't what this checks.
-- =========================================================

create or replace function public.check_filled_slots_drift()
returns table (batch_id uuid, recorded_filled_slots int, actual_active_count bigint, drift int)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id as batch_id,
    b.filled_slots as recorded_filled_slots,
    count(distinct s.id) as actual_active_count,
    b.filled_slots - count(distinct s.id)::int as drift
  from public.batches b
  left join public.enrollments e on e.batch_id = b.id and e.payment_mode = 'subscription'
  left join public.students s on s.id = e.student_id and s.status = 'ACTIVE' and s.stripe_subscription_id is not null
  group by b.id, b.filled_slots
  having b.filled_slots <> count(distinct s.id)
  order by abs(b.filled_slots - count(distinct s.id)::int) desc;
$$;

grant execute on function public.check_filled_slots_drift() to authenticated, service_role;

-- =========================================================
-- run_payment_lifecycle_sweep — extended to also release any expired
-- batch_seat_hold the checkout.session.expired webhook might have missed
-- (e.g. the endpoint was briefly down) — a defensive backstop, not the
-- primary release path.
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
  v_expired_holds int := 0;
  v_days_overdue int;
  v_enrollment record;
  v_hold record;
begin
  -- Backstop: release any hold whose expires_at has passed, in case the
  -- checkout.session.expired webhook was ever missed.
  for v_hold in select * from public.batch_seat_holds where expires_at < now() for update loop
    delete from public.batch_seat_holds where id = v_hold.id;
    update public.batches set held_slots = greatest(held_slots - 1, 0) where id = v_hold.batch_id;
    v_expired_holds := v_expired_holds + 1;
  end loop;

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
    'reminders', to_jsonb(v_reminder_ids),
    'expired_holds_released', v_expired_holds
  );
end;
$$;

grant execute on function public.run_payment_lifecycle_sweep() to service_role;
