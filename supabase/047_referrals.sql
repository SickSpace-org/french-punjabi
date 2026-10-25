-- French Punjabi — referral program (A6).
--
-- PLAIN LANGUAGE: pure addition. Two new columns on students
-- (referral_code, has_pending_referral_discount — both default to a safe
-- empty value for every existing row) and one new table. No existing
-- column, constraint, or RLS policy is touched. Safe to re-run.
--
-- Code format: 8 chars, uppercase, from a 32-character alphabet with
-- ambiguous characters (0/O, 1/I/L) removed — same alphabet style as the
-- existing enrollment_ref generator. Generated lazily (on first visit to
-- the referral section, see generate_referral_code below), not at
-- signup, since most students will never need one.
--
-- Reward rules, enforced here:
--   - Referred student: $25 off their FIRST invoice only (applied
--     directly on the Checkout Session as a one-time coupon — see
--     subscriptionCheckout.ts — not tracked in this table at all, since
--     "first invoice" is self-evidently single-use by definition).
--   - Referrer: $25 off ONE upcoming invoice, earned only once the
--     referred student's FIRST payment actually succeeds (never at
--     signup or trial start) — enforced by only crediting from
--     record_subscription_payment_succeeded, and specifically gated to
--     fire once per referred student via the unique constraint on
--     student_referrals.referred_enrollment_id.
--   - Never a reusable balance: the $25 is a Stripe Coupon with
--     duration:'once' — Stripe's own platform enforces it consumes
--     exactly one invoice and then stops, not application logic here.
--   - Max one $25 discount applied per referrer per cycle: tracked via
--     students.has_pending_referral_discount — a second credit earned
--     while one is already pending consumption is queued (status
--     'earned', not yet 'applied') rather than dropped, and gets applied
--     automatically the next time that referrer's own invoice succeeds
--     (see record_subscription_payment_succeeded's extension below).
--   - No self-referral: enforced in TS at redemption time (compares the
--     referrer's email to the checkout email), not here.
--   - No duplicate use of the same referral: the existing one-trial-per-
--     email rule (trial_dedupe_signals) already makes it structurally
--     impossible for the same email to sign up (and thus redeem a code)
--     twice.

alter table public.students add column if not exists referral_code text;
alter table public.students add column if not exists has_pending_referral_discount boolean not null default false;

alter table public.students drop constraint if exists students_referral_code_key;
alter table public.students add constraint students_referral_code_key unique (referral_code);

create table if not exists public.student_referrals (
  id                      uuid primary key default gen_random_uuid(),
  referrer_student_id     uuid not null references public.students (id) on delete cascade,
  referred_enrollment_id  uuid not null references public.enrollments (id) on delete cascade,
  referred_student_id     uuid references public.students (id) on delete set null,
  referral_code           text not null,
  status                  text not null default 'pending',
  created_at              timestamptz not null default now(),
  earned_at               timestamptz,
  applied_at              timestamptz,
  constraint student_referrals_status_check check (status in ('pending', 'earned', 'applied')),
  constraint student_referrals_referred_enrollment_key unique (referred_enrollment_id)
);

create index if not exists student_referrals_referrer_idx on public.student_referrals (referrer_student_id);

alter table public.student_referrals enable row level security;

drop policy if exists "student_referrals_admin_select" on public.student_referrals;
create policy "student_referrals_admin_select" on public.student_referrals
  for select using (public.is_admin());

-- A student may read their OWN referrals (as referrer) for the Student
-- Hub "friends joined / credit earned" section — never anyone else's.
drop policy if exists "student_referrals_self_select" on public.student_referrals;
create policy "student_referrals_self_select" on public.student_referrals
  for select using (
    exists (select 1 from public.students s where s.id = referrer_student_id and s.auth_user_id = auth.uid())
  );

grant select on public.student_referrals to authenticated;

-- =========================================================
-- generate_referral_code — idempotent: returns the existing code if
-- already assigned, otherwise mints and saves a fresh one. Retries on
-- the astronomically unlikely unique-constraint collision.
-- =========================================================

create or replace function public.generate_referral_code(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempt int := 0;
begin
  select referral_code into v_existing from public.students where id = p_student_id;
  if v_existing is not null then
    return v_existing;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_chars, (floor(random() * length(v_chars)) + 1)::int, 1);
    end loop;

    begin
      update public.students set referral_code = v_code where id = p_student_id;
      return v_code;
    exception when unique_violation then
      if v_attempt >= 10 then
        raise exception 'Could not generate a unique referral code after 10 attempts';
      end if;
    end;
  end loop;
end;
$$;

grant execute on function public.generate_referral_code(uuid) to authenticated;

-- =========================================================
-- redeem_referral_code — called from createSubscriptionCheckout (anon
-- role) right after the enrollment row is created. Validates the code
-- resolves to a real student and records the pending referral; the
-- caller is responsible for the no-self-referral email check (that
-- needs the checkout's own email, which this function doesn't receive)
-- and for applying the referred-student discount on the Checkout Session
-- itself.
-- =========================================================

create or replace function public.redeem_referral_code(p_code text, p_enrollment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  select id into v_referrer_id from public.students where referral_code = p_code;

  if v_referrer_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  insert into public.student_referrals (referrer_student_id, referred_enrollment_id, referral_code)
  values (v_referrer_id, p_enrollment_id, p_code);

  return jsonb_build_object('ok', true, 'referrer_student_id', v_referrer_id);
end;
$$;

grant execute on function public.redeem_referral_code(text, uuid) to anon, authenticated;

-- =========================================================
-- credit_referral_if_earned — called from the webhook's
-- record_subscription_payment_succeeded path for the REFERRED student
-- specifically, right after their first payment succeeds. Separate
-- function (not folded into record_subscription_payment_succeeded
-- itself) so that function stays about ONE student's own payment, not
-- entangled with a different student's reward.
-- =========================================================

create or replace function public.credit_referral_if_earned(p_referred_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.student_referrals%rowtype;
  v_referrer public.students%rowtype;
begin
  select * into v_referral from public.student_referrals
    where referred_student_id = p_referred_student_id and status = 'pending'
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_pending_referral');
  end if;

  select * into v_referrer from public.students where id = v_referral.referrer_student_id for update;

  update public.student_referrals set status = 'earned', earned_at = now() where id = v_referral.id;

  insert into public.payment_events (student_id, event_type, note)
  values (p_referred_student_id, 'referral_credited', 'Referral earned for referrer ' || v_referral.referrer_student_id);

  if v_referrer.has_pending_referral_discount then
    -- Referrer already has an unconsumed discount this cycle — queue
    -- this one (stays 'earned') instead of dropping it.
    return jsonb_build_object('ok', true, 'queued', true, 'referrer_student_id', v_referrer.id);
  end if;

  update public.student_referrals set status = 'applied', applied_at = now() where id = v_referral.id;
  update public.students set has_pending_referral_discount = true where id = v_referrer.id;

  return jsonb_build_object('ok', true, 'queued', false, 'referrer_student_id', v_referrer.id, 'referral_id', v_referral.id);
end;
$$;

grant execute on function public.credit_referral_if_earned(uuid) to service_role;

-- =========================================================
-- apply_queued_referral_if_any — called whenever ANY student's own
-- invoice.payment_succeeded fires (see the TS change to
-- record_subscription_payment_succeeded's caller), to release a queued
-- referral credit on the first invoice where there's room for it.
-- =========================================================

create or replace function public.apply_queued_referral_if_any(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.student_referrals%rowtype;
begin
  select * into v_referral from public.student_referrals
    where referrer_student_id = p_student_id and status = 'earned'
    order by earned_at asc
    limit 1
    for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'none_queued');
  end if;

  update public.student_referrals set status = 'applied', applied_at = now() where id = v_referral.id;
  update public.students set has_pending_referral_discount = true where id = p_student_id;

  return jsonb_build_object('ok', true, 'referral_id', v_referral.id);
end;
$$;

grant execute on function public.apply_queued_referral_if_any(uuid) to service_role;

-- =========================================================
-- record_subscription_payment_succeeded — extended to:
--   1. Reset has_pending_referral_discount to false (Stripe's 'once'
--      coupon just consumed on THIS invoice, if one was pending).
--   2. If the student is a referred student paying for the first time,
--      credit their referrer (handled by the TS caller invoking
--      credit_referral_if_earned — not inlined here, to keep this
--      function's own transaction focused on ONE student's payment).
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
  v_is_first_payment boolean;
begin
  select * into v_student from public.students where stripe_subscription_id = p_stripe_subscription_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  v_was_suspended := v_student.status = 'SUSPENDED';
  v_is_first_payment := not exists (
    select 1 from public.payment_events where student_id = v_student.id and event_type = 'payment_succeeded'
  );

  update public.students
  set subscription_status = p_subscription_status,
      next_payment_due_at = p_next_payment_due_at,
      course_expiry_at = p_next_payment_due_at,
      payment_failure_count = 0,
      grace_period_ends_at = null,
      has_pending_referral_discount = false,
      status = case when v_was_suspended then 'ACTIVE' else status end
  where id = v_student.id;

  insert into public.payment_events (student_id, event_type, amount, currency, note)
  values (v_student.id, 'payment_succeeded', p_amount, p_currency, 'invoice.payment_succeeded');

  if v_was_suspended then
    insert into public.payment_events (student_id, event_type, note)
    values (v_student.id, 'access_restored', 'Paid while SUSPENDED — restored to ACTIVE immediately.');
  end if;

  return jsonb_build_object('ok', true, 'student_id', v_student.id, 'was_suspended', v_was_suspended, 'is_first_payment', v_is_first_payment);
end;
$$;

grant execute on function public.record_subscription_payment_succeeded(
  text, numeric, text, timestamptz, text
) to service_role;
