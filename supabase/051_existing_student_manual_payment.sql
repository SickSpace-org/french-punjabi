-- French Punjabi — Checkpoint 3, Phase 2: admin manual-payment recording
-- for existing (non-Stripe) students.
--
-- PLAIN LANGUAGE: pure addition — two new functions, no existing column,
-- constraint, RLS policy, or function is touched. Nothing here runs
-- automatically; both functions are only ever invoked by an explicit admin
-- click (there is no cron/webhook call anywhere in this file). Cannot
-- affect any Stripe-subscribed student — both functions refuse to act on
-- a student whose stripe_subscription_id is not null. Safe to re-run
-- (create or replace).
--
-- What's in here:
--   1. settle_existing_student_payment — the shared core logic: clears
--      payment_failure_count, advances next_payment_due by exactly one
--      billing cycle using month-end-safe date math (Jan 31 -> Feb 28 ->
--      Mar 28, never drifting back toward 31 — see the comment on the
--      function itself), restores a SUSPENDED student to ACTIVE, and
--      reactivates an INACTIVE student only if their batch still has
--      room (seat-aware, same spirit as admin_reactivate_student but
--      using the student's ACTUAL latest enrollment regardless of
--      payment_mode — admin_reactivate_student only looks at
--      payment_mode = 'subscription' enrollments, which an existing
--      student never has, so it would silently skip the seat check for
--      them). Granted to service_role only — it trusts its caller to
--      have already authenticated the action, same pattern as every
--      other internal-only function in this project.
--   2. record_manual_payment_for_existing_student — the is_admin()-gated
--      wrapper the admin UI actually calls. Thin: checks admin, checks
--      the student is a real existing (non-Stripe) student, then calls
--      the shared function above.
--
-- If advancing the due date by one cycle still lands in the past (e.g. a
-- student who hasn't paid in several months), this does NOT guess how
-- many cycles to skip — it leaves next_payment_due as-is and sets
-- next_payment_due_needs_review = true instead, exactly as proposed.

create or replace function public.settle_existing_student_payment(
  p_student_id uuid,
  p_amount numeric,
  p_currency text,
  p_event_type text,
  p_note text,
  p_created_by uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_enrollment record;
  v_batch public.batches%rowtype;
  v_old_due date;
  v_candidate date;
  v_target_month_first date;
  v_target_month_last_day int;
  v_needs_review boolean := false;
  v_reactivated boolean := false;
  v_reactivation_blocked boolean := false;
  v_payment_mode text;
begin
  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;
  if v_student.stripe_subscription_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'stripe_managed_student');
  end if;

  -- Same "excluded until classified" rule as
  -- existing_student_lifecycle_eligible (migration 052) — a 'full' or
  -- unclassified student has no recurring due-date cycle for this to
  -- advance, so this is the real authorization boundary for that, not
  -- just the admin UI hiding the button.
  select payment_mode into v_payment_mode from public.enrollments
    where student_id = p_student_id
    order by created_at desc
    limit 1;
  if v_payment_mode is distinct from 'monthly' then
    return jsonb_build_object('ok', false, 'reason', 'not_monthly');
  end if;

  -- Month-end-safe "add one billing cycle": same day next month, clamped
  -- to that month's actual last day if the day doesn't exist there (Jan
  -- 31 -> Feb 28). Deliberately bases the NEXT advance on whatever day
  -- this one landed on (28, say), never on the ORIGINAL enrollment day —
  -- so a student clamped down in February stays on day 28 from then on,
  -- rather than jumping back up to 31 the next time a 31-day month comes
  -- around. That's what "must not drift" means here.
  -- No previous due date (this student's first recorded payment) uses
  -- today as the base instead of v_old_due — but still through the exact
  -- same clamped math, not a raw `+ interval '1 month'`, which has this
  -- same overflow problem in plain Postgres date arithmetic (Jan 31 +
  -- interval '1 month' silently becomes Mar 3, not Feb 28).
  v_old_due := v_student.next_payment_due;
  v_target_month_first := (date_trunc('month', coalesce(v_old_due, current_date)) + interval '1 month')::date;
  v_target_month_last_day := extract(day from (date_trunc('month', v_target_month_first) + interval '1 month' - interval '1 day'))::int;
  v_candidate := v_target_month_first + (least(extract(day from coalesce(v_old_due, current_date))::int, v_target_month_last_day) - 1);

  if v_old_due is not null and v_candidate <= current_date then
    -- One cycle isn't enough to reach the future — flag it, don't guess.
    v_needs_review := true;
    update public.students set next_payment_due_needs_review = true where id = p_student_id;
  else
    update public.students set next_payment_due = v_candidate, next_payment_due_needs_review = false where id = p_student_id;
  end if;

  update public.students set payment_failure_count = 0 where id = p_student_id;

  if v_student.status = 'SUSPENDED' then
    update public.students set status = 'ACTIVE', grace_period_ends_at = null where id = p_student_id;
  elsif v_student.status = 'INACTIVE' then
    select * into v_enrollment from public.enrollments
      where student_id = p_student_id
      order by created_at desc
      limit 1;

    if v_enrollment.batch_id is not null then
      select * into v_batch from public.batches where id = v_enrollment.batch_id for update;
      if v_batch.total_slots is not null and v_batch.filled_slots + v_batch.held_slots >= v_batch.total_slots then
        v_reactivation_blocked := true;
      else
        update public.batches set filled_slots = filled_slots + 1 where id = v_batch.id;
        update public.students set status = 'ACTIVE' where id = p_student_id;
        v_reactivated := true;
      end if;
    else
      -- No batch on record at all — nothing to check capacity against,
      -- so there's nothing stopping reactivation.
      update public.students set status = 'ACTIVE' where id = p_student_id;
      v_reactivated := true;
    end if;
  end if;

  insert into public.payment_events (student_id, enrollment_id, event_type, amount, currency, created_by, note)
  values (
    p_student_id,
    (select id from public.enrollments where student_id = p_student_id order by created_at desc limit 1),
    p_event_type, p_amount, p_currency, p_created_by,
    p_note || case when v_needs_review then ' — due date needs manual review (one cycle not enough to reach the future)' else '' end
      || case when v_reactivation_blocked then ' — could NOT reactivate: batch is full, needs admin attention' else '' end
  );

  return jsonb_build_object(
    'ok', true,
    'next_payment_due', case when v_needs_review then null else v_candidate end,
    'needs_review', v_needs_review,
    'reactivated', v_reactivated,
    'reactivation_blocked', v_reactivation_blocked
  );
end;
$$;

revoke all on function public.settle_existing_student_payment(uuid, numeric, text, text, text, uuid) from public;
grant execute on function public.settle_existing_student_payment(uuid, numeric, text, text, text, uuid) to service_role;

-- =========================================================
-- record_manual_payment_for_existing_student — is_admin()-gated wrapper.
-- =========================================================

create or replace function public.record_manual_payment_for_existing_student(
  p_student_id uuid,
  p_amount numeric,
  p_currency text,
  p_note text default 'Manual payment recorded by admin'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  return public.settle_existing_student_payment(
    p_student_id, p_amount, p_currency, 'manual_payment_recorded', p_note, auth.uid()
  );
end;
$$;

grant execute on function public.record_manual_payment_for_existing_student(uuid, numeric, text, text) to authenticated;
