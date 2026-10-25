-- French Punjabi — explicit inactive_reason, replacing the re-enrollment
-- eligibility inference with a recorded fact.
--
-- PLAIN LANGUAGE: pure addition — two new nullable columns on students
-- (inactive_reason, subscription_cap_at), and four existing functions
-- re-defined (create or replace — same signatures except
-- handle_subscription_canceled, which gains one new optional parameter)
-- to record WHY a student went INACTIVE, instead of a later reader trying
-- to guess from payment_failure_count. No existing row is touched by this
-- migration itself — every current INACTIVE student gets inactive_reason
-- = NULL, which the application treats as "not eligible to re-enroll"
-- (see src/lib/payments/reenrollEligibility.ts) until something explicit
-- is known. This is deliberate: better to leave it unknown than guess
-- wrong and let an actually-non-paying student back in, or wrongly block
-- someone who genuinely finished. An admin can set a specific existing
-- student's inactive_reason by hand if a real case needs it. Safe to
-- re-run.
--
-- The four reasons, and who sets each, going forward:
--   'phase_completed' — handle_subscription_canceled, when the
--     cancellation lines up with the student's OWN recorded
--     subscription_cap_at (see below) — the phase's cap (cancel_at) was
--     reached on schedule, nothing paid or owed is outstanding.
--   'cancelled'        — handle_subscription_canceled, any OTHER
--     cancellation reaching Stripe (student used the Customer Portal to
--     cancel early, or anything else that isn't the recorded cap).
--   'non_payment'       — run_payment_lifecycle_sweep, the day-14
--     non-payment sweep.
--   'admin'             — admin_deactivate_student.
--
-- subscription_cap_at records the cap THIS APP intended when the
-- subscription was created (src/lib/payments/phaseLength.ts's
-- PHASE_LENGTH_SECONDS from checkout time) — stored in our own database
-- rather than read back from Stripe's live cancel_at at cancellation
-- time, because cancel_at is NOT a reliable signal on its own: a student
-- cancelling early via the Stripe Customer Portal overwrites the
-- subscription's cancel_at to their current period end (Stripe's
-- documented Customer Portal default is cancel_at_period_end, not an
-- immediate cancel), which would otherwise look identical to our own cap
-- firing on schedule. Comparing against OUR OWN stored value, set once at
-- creation and never touched by the customer, is what actually
-- distinguishes the two.

alter table public.students add column if not exists inactive_reason text;
alter table public.students drop constraint if exists students_inactive_reason_check;
alter table public.students add constraint students_inactive_reason_check
  check (inactive_reason in ('phase_completed', 'cancelled', 'non_payment', 'admin') or inactive_reason is null);

alter table public.students add column if not exists subscription_cap_at timestamptz;

-- =========================================================
-- 1. handle_subscription_canceled — now takes the real cancellation
--    timestamp (from the Stripe event itself) so it can tell a
--    phase_completed ending from any other kind. Also clears
--    stripe_subscription_id/subscription_status/subscription_cap_at for a
--    phase_completed ending specifically — so the student's Subscription
--    page correctly falls back to its "no active subscription" branch
--    (which is what actually shows the re-enrollment picker) instead of
--    rendering stale details from a subscription that's done. Left as-is
--    for every other reason — an explicit cancellation or non-payment
--    case keeps stripe_subscription_id for admin/support to look back on,
--    same as today.
-- =========================================================

create or replace function public.handle_subscription_canceled(
  p_stripe_subscription_id text,
  p_canceled_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_reason text;
begin
  select * into v_student from public.students where stripe_subscription_id = p_stripe_subscription_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  if v_student.status = 'INACTIVE' then
    update public.students set subscription_status = 'canceled' where id = v_student.id;
    return jsonb_build_object('ok', true, 'student_id', v_student.id, 'already_inactive', true);
  end if;

  select * into v_enrollment from public.enrollments
    where student_id = v_student.id and payment_mode = 'subscription'
    order by created_at desc
    limit 1
    for update;

  -- Within a day of the recorded cap counts as "the cap fired on
  -- schedule" — generous enough to absorb webhook delivery delay, never
  -- so wide it could mistake an early portal cancellation for a clean
  -- completion.
  if v_student.subscription_cap_at is not null and p_canceled_at is not null
     and abs(extract(epoch from (p_canceled_at - v_student.subscription_cap_at))) < 86400 then
    v_reason := 'phase_completed';
  else
    v_reason := 'cancelled';
  end if;

  if v_reason = 'phase_completed' then
    update public.students
    set status = 'INACTIVE',
        subscription_status = null,
        stripe_subscription_id = null,
        subscription_cap_at = null,
        inactive_reason = v_reason
    where id = v_student.id;
  else
    update public.students
    set status = 'INACTIVE',
        subscription_status = 'canceled',
        inactive_reason = v_reason
    where id = v_student.id;
  end if;

  if v_enrollment.batch_id is not null then
    update public.batches set filled_slots = greatest(filled_slots - 1, 0) where id = v_enrollment.batch_id;
  end if;

  insert into public.payment_events (student_id, enrollment_id, event_type, note)
  values (v_student.id, v_enrollment.id, 'subscription_canceled', 'customer.subscription.deleted (' || v_reason || ') — seat released');

  return jsonb_build_object('ok', true, 'student_id', v_student.id, 'batch_id', v_enrollment.batch_id, 'already_inactive', false, 'inactive_reason', v_reason);
end;
$$;

grant execute on function public.handle_subscription_canceled(text, timestamptz) to service_role;

-- =========================================================
-- 2. run_payment_lifecycle_sweep — day-14 non-payment branch now also
--    records inactive_reason = 'non_payment'. Full function body
--    restated (not just the one changed line) since create or replace
--    needs the whole thing.
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
        grace_period_ends_at = null,
        inactive_reason = 'non_payment'
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

-- =========================================================
-- 3. admin_deactivate_student — both branches now record
--    inactive_reason = 'admin'.
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
    update public.students set status = 'INACTIVE', inactive_reason = 'admin' where id = p_student_id;
    return jsonb_build_object('ok', true, 'stripe_subscription_id', null);
  end if;

  select * into v_enrollment from public.enrollments
    where student_id = p_student_id and payment_mode = 'subscription'
    order by created_at desc
    limit 1
    for update;

  update public.students
  set status = 'INACTIVE',
      grace_period_ends_at = null,
      inactive_reason = 'admin'
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
-- 4. admin_reactivate_student — clears inactive_reason on reactivation,
--    same as it already clears grace_period_ends_at.
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
      grace_period_ends_at = null,
      inactive_reason = null
  where id = p_student_id;

  insert into public.payment_events (student_id, enrollment_id, event_type, created_by, note)
  values (p_student_id, v_enrollment.id, 'access_restored', auth.uid(), 'Admin-initiated reactivation' || (case when p_override then ' (capacity override)' else '' end));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_reactivate_student(uuid, boolean) to authenticated;
