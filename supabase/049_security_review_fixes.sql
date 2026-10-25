-- French Punjabi — Checkpoint 3 security review: three fixes found while
-- testing with real signed-in sessions (not just reading code).
--
-- PLAIN LANGUAGE: pure addition plus two bug fixes in existing functions'
-- BODIES ONLY (no signature, column, or RLS policy change on anything
-- pre-existing). Safe to re-run (create or replace / add column if not
-- exists / add constraint after drop-if-exists).
--
--   1. CRITICAL — activate_subscription_enrollment never linked
--      student_referrals.referred_student_id to the new student it just
--      created. This meant credit_referral_if_earned (which looks up a
--      referral row BY referred_student_id) could never find a match for
--      ANY real referral, ever — the entire referral reward program has
--      been non-functional in production since it shipped. It only
--      "passed" testing because my test scripts set that link manually,
--      papering over the gap instead of exercising the real path. Fixed
--      by setting the link inside the same transaction that creates the
--      student. Affects nothing else — this function's existing behavior
--      for every non-referred signup is unchanged.
--
--   2. check_filled_slots_drift had no actual admin check in its body —
--      it was granted to any authenticated user, meaning a signed-in
--      STUDENT (not just an admin) could call it directly and see
--      batch-level seat-drift data meant for admin eyes only. No student
--      personal data was exposed (only batch ids and counts), but it's a
--      real authorization gap. Fixed by adding the same is_admin() guard
--      every other admin-only function in this project already uses.
--      Converts its language from `sql` to `plpgsql` to allow that check
--      — the output columns are unchanged, so CREATE OR REPLACE applies
--      cleanly (only a RETURNS TABLE column RENAME would require DROP
--      FUNCTION first, and nothing here is renamed).
--
--   3. NEW — reverse_referral_if_refunded: "a refunded first payment must
--      not leave a referral reward standing" (a requirement from early in
--      this engagement that was never implemented). When the REFERRED
--      student's first payment gets refunded, this reverses their
--      referrer's reward: if it was already attached to the referrer's
--      subscription as a live (unconsumed) discount, removes it and
--      clears has_pending_referral_discount so a queued second referral
--      can still be released normally; if it was only queued ('earned',
--      never attached), just marks it voided. Cannot claw back a discount
--      that already finished discounting a past invoice — Stripe's
--      duration:'once' coupon has nothing left to remove by then; that's
--      an inherent limit of a one-time discount, not a bug. Adds
--      'reversed' as a new student_referrals.status value and a
--      reversed_at column (both additive), and 'referral_reversed' as a
--      new payment_events.event_type value (also additive — widens an
--      existing CHECK constraint this project itself introduced).

-- =========================================================
-- 1. activate_subscription_enrollment — link the referral to the new
--    student the moment it's created.
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

  -- FIX 1 — the missing link. redeem_referral_code (called at checkout
  -- time, before this student exists) can only record referred_enrollment_id;
  -- this is the first moment the resulting student_id is known. The
  -- `where referred_student_id is null` guard makes this safe to run even
  -- if this function is ever re-invoked for the same enrollment.
  update public.student_referrals
  set referred_student_id = v_student_id
  where referred_enrollment_id = p_enrollment_id and referred_student_id is null;

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
-- 2. check_filled_slots_drift — add the missing is_admin() guard.
-- =========================================================

create or replace function public.check_filled_slots_drift()
returns table (batch_id uuid, recorded_filled_slots int, actual_active_count bigint, drift int)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    b.id as batch_id,
    b.filled_slots as recorded_filled_slots,
    count(distinct s.id) as actual_active_count,
    b.filled_slots - count(distinct s.id)::int as drift
  from public.batches b
  join public.enrollments e on e.batch_id = b.id
  left join public.students s
    on s.id = e.student_id
    and s.status in ('ACTIVE', 'SUSPENDED')
    and s.stripe_subscription_id is not null
    and e.payment_mode = 'subscription'
  where not exists (
    select 1 from public.enrollments e2
    where e2.batch_id = b.id and e2.payment_mode in ('full', 'monthly')
  )
  group by b.id, b.filled_slots
  having b.filled_slots <> count(distinct s.id)
  order by abs(b.filled_slots - count(distinct s.id)::int) desc;
end;
$$;

grant execute on function public.check_filled_slots_drift() to authenticated, service_role;

-- =========================================================
-- 3. reverse_referral_if_refunded — new.
-- =========================================================

alter table public.student_referrals add column if not exists reversed_at timestamptz;
alter table public.student_referrals drop constraint if exists student_referrals_status_check;
alter table public.student_referrals add constraint student_referrals_status_check
  check (status in ('pending', 'earned', 'applied', 'reversed'));

alter table public.payment_events drop constraint if exists payment_events_event_type_check;
alter table public.payment_events add constraint payment_events_event_type_check check (event_type in (
  'payment_succeeded', 'payment_failed', 'payment_overdue_reminder', 'trial_started', 'trial_ending',
  'access_suspended', 'access_restored', 'access_revoked',
  'subscription_canceled', 'lost_race_waitlisted', 'duplicate_trial_card',
  'charge_refunded', 'charge_disputed', 'reconciliation_mismatch',
  'manual_payment_recorded', 'manual_expiry_edit', 'referral_credited', 'referral_reversed'
));

create or replace function public.reverse_referral_if_refunded(p_referred_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.student_referrals%rowtype;
begin
  select * into v_referral from public.student_referrals
    where referred_student_id = p_referred_student_id and status in ('earned', 'applied')
    for update;

  if not found then
    return jsonb_build_object('ok', true, 'reversed', false, 'reason', 'no_active_referral');
  end if;

  update public.student_referrals
  set status = 'reversed', reversed_at = now()
  where id = v_referral.id;

  insert into public.payment_events (student_id, event_type, note)
  values (
    p_referred_student_id, 'referral_reversed',
    'Referred student''s first payment was refunded — referrer ' || v_referral.referrer_student_id || '''s reward reversed.'
  );

  -- Only an 'applied' referral was actually holding the referrer's
  -- "one pending discount" slot — an 'earned' (queued) one never set
  -- has_pending_referral_discount in the first place (see
  -- credit_referral_if_earned), so there's nothing to clear for it.
  if v_referral.status = 'applied' then
    update public.students set has_pending_referral_discount = false where id = v_referral.referrer_student_id;
    return jsonb_build_object('ok', true, 'reversed', true, 'was_applied', true, 'referrer_student_id', v_referral.referrer_student_id);
  end if;

  return jsonb_build_object('ok', true, 'reversed', true, 'was_applied', false, 'referrer_student_id', v_referral.referrer_student_id);
end;
$$;

grant execute on function public.reverse_referral_if_refunded(uuid) to service_role;
