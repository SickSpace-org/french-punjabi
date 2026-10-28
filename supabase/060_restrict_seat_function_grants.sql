-- French Punjabi — 060: tighten who can run the functions that move seat counters. NOT APPLIED. For the paused stripe-tax branch.
--
-- PLAIN LANGUAGE
--   The migrations that created the payment functions say "grant execute ... to service_role", which reads as
--   "only our server can run this". It does not. In Postgres every new function is executable by PUBLIC unless a
--   REVOKE is run, and Supabase additionally grants new public-schema functions to anon and authenticated. Only
--   migration 051 ever revoked anything (and only from PUBLIC, which does not remove anon's own default grant).
--   So unless the live project's grants were changed by hand, anyone holding the public anon key (it is in the site's
--   JavaScript) can call functions such as activate_subscription_enrollment, run_payment_lifecycle_sweep,
--   handle_subscription_canceled or settle_existing_student_payment directly. Several of them have no check of their own
--   inside, because they were written to trust "only service_role can reach me".
--   Run supabase/SEAT-FUNCTION-GRANTS_readonly_query.sql (query 1) first: if every service-role-only row already says
--   "ok", this migration changes nothing and can be skipped.
--
--   Fix, in three small parts:
--     A. reserve_batch_seat must keep working for anon (the public checkout calls it with the anon key) but must stop
--        trusting the app to have checked availability_status: add the same full/hidden/inactive refusal the app already does.
--     B. Service-role-only functions: revoke from PUBLIC, anon and authenticated; grant to service_role (the server keeps working).
--     C. Admin-only functions (their bodies already check is_admin()): revoke from PUBLIC and anon, keep authenticated.
--   NOT touched on purpose: reserve_batch_seat and release_batch_seat_hold grants (anon and authenticated are needed, see below),
--   has_used_trial_email and redeem_referral_code (anon checkout needs them), every table and policy, and all data.
--
-- WHO CALLS WHAT (checked in the code on main 46ab44b)
--   reserve_batch_seat       anon client (subscriptionCheckout, publicEnrollCheckout) + signed-in client (phaseReenrollmentCheckout)
--   release_batch_seat_hold  same three files, on failure paths (anon / signed-in) + service role (webhook, checkout.session.expired)
--   activate_subscription_enrollment, activate_full_payment_enrollment, handle_subscription_canceled,
--   record_existing_student_stripe_payment, attach_stripe_to_existing_student   service role only (stripe webhook)
--   run_payment_lifecycle_sweep, handle_subscription_canceled (reconcile)        service role only (daily cron)
--   settle_existing_student_payment   only inside the two wrappers above/below (runs as owner), never called by the app
--   admin_deactivate_student, admin_reactivate_student, record_manual_payment_for_existing_student   signed-in admin session
--
-- IF A WRONG GRANT IS REVOKED (so you can recognise the symptom)
--   revoke execute on reserve_batch_seat from anon          -> every anonymous checkout fails at the seat hold; the app reports
--                                                               "batch_unavailable" (looks like a full batch), no Stripe session is
--                                                               created, and an orphan enrollment row is left behind (it is inserted first)
--   revoke execute on reserve_batch_seat from authenticated -> same, for signed-in students re-enrolling into a new phase
--   revoke execute on release_batch_seat_hold from anon     -> a failed checkout cannot give its seat back; the hold stays until it
--                                                               expires and the daily sweep runs (up to a day of a seat looking taken)
--   revoke execute on a service-role-only function from service_role -> Stripe webhook / cron fail with 500 and Stripe keeps retrying
-- Rollback for part B and C is at the bottom (commented). Part A rollback = re-run the original function from 042 (also at the bottom).

-- =========================================================
-- A. reserve_batch_seat — add the availability checks the SQL was relying on the app for. Grants are unchanged
--    (create or replace keeps them). Same signature as 042, so no second overload is created.
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

  -- NEW: the same refusals the app makes before calling us (inactive, full, hidden). Callers treat any
  -- {ok:false} the same way, so a new reason code is safe.
  if not coalesce(v_batch.is_active, false)
     or v_batch.availability_status in ('full', 'hidden') then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
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

-- =========================================================
-- B + C. Grants. One loop so a signature that does not exist (for example the stale 042 overload after it is dropped,
--        or a function from a migration that was never run) is skipped instead of aborting the whole migration.
-- =========================================================
do $$
declare
  rec record;
  v_sig text;
begin
  -- B. service-role-only
  foreach v_sig in array array[
    'public.activate_subscription_enrollment(uuid,uuid,text,text,numeric,text,timestamptz,text,boolean,text)',
    'public.activate_subscription_enrollment(uuid,uuid,text,text,numeric,text,timestamptz,text)',   -- stale 042 overload, see optional D
    'public.activate_full_payment_enrollment(uuid,uuid,text,numeric,text)',
    'public.handle_subscription_canceled(text,timestamptz)',
    'public.run_payment_lifecycle_sweep()',
    'public.settle_existing_student_payment(uuid,numeric,text,text,text,uuid)',
    'public.record_existing_student_stripe_payment(uuid,numeric,text,text)',
    'public.attach_stripe_to_existing_student(uuid,text,text,text)'
  ] loop
    if to_regprocedure(v_sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', v_sig);
      execute format('grant execute on function %s to service_role', v_sig);
      raise notice 'service-role only: %', v_sig;
    else
      raise notice 'skipped (does not exist): %', v_sig;
    end if;
  end loop;

  -- C. admin-only (each body starts with: if not public.is_admin() then raise exception 'not authorized')
  foreach v_sig in array array[
    'public.admin_deactivate_student(uuid)',
    'public.admin_reactivate_student(uuid,boolean)',
    'public.record_manual_payment_for_existing_student(uuid,numeric,text,text)'
  ] loop
    if to_regprocedure(v_sig) is not null then
      execute format('revoke all on function %s from public, anon', v_sig);
      execute format('grant execute on function %s to authenticated, service_role', v_sig);
      raise notice 'signed-in only: %', v_sig;
    else
      raise notice 'skipped (does not exist): %', v_sig;
    end if;
  end loop;
end
$$;

-- =========================================================
-- Check after applying (read-only): re-run query 1 of supabase/SEAT-FUNCTION-GRANTS_readonly_query.sql.
-- Expected: every 'service_role' row says anon=false, authenticated=false, service_role=true, verdict ok;
--           reserve_batch_seat and release_batch_seat_hold still anon=true, authenticated=true;
--           admin_* rows anon=false, authenticated=true.
-- Then smoke-test on the live site BEFORE announcing anything: open a public enrollment checkout as a signed-out visitor
-- (the flags must be on for that, so do it in test mode with the Stripe test key), and run one webhook replay
-- from the Stripe dashboard.
-- =========================================================

-- =========================================================
-- OPTIONAL D (leave commented until query 3 shows two activate_subscription_enrollment rows):
-- drop the stale 8-argument function from migration 042. The webhook always calls the 10-argument version.
-- =========================================================
-- drop function if exists public.activate_subscription_enrollment(uuid,uuid,text,text,numeric,text,timestamptz,text);

-- =========================================================
-- OPTIONAL E (same exposure pattern, not seat counters; run after query 1 confirms it): service-role-only functions
-- that do not touch the seat counters. Same revoke/grant as part B.
-- =========================================================
-- revoke all on function public.record_payment_failed(text,numeric,text) from public, anon, authenticated;
--   grant execute on function public.record_payment_failed(text,numeric,text) to service_role;
-- (record_subscription_payment_succeeded, record_payment_alert, credit_referral_if_earned, apply_queued_referral_if_any,
--  reverse_referral_if_refunded: take their exact argument lists from query 1's "arguments" column.)

-- =========================================================
-- ROLLBACK (only if something that should have worked fails after applying)
-- =========================================================
-- B/C: restore the default openness for one function, for example
--   grant execute on function public.run_payment_lifecycle_sweep() to public, anon, authenticated, service_role;
-- A: re-run the original reserve_batch_seat from supabase/042_stripe_subscription_core.sql lines 209-241.
