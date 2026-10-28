-- French Punjabi — 061: revoke public/anon/authenticated execute on the remaining service-role-only payment functions.
--
-- ALREADY APPLIED to the live database by hand on 2026-10-27 (right after 060). This file records exactly that change so the
-- repository history matches the live database. Running it again is harmless: revoke and grant are repeatable, and a signature that
-- does not exist is skipped with a notice instead of an error.
--
-- PLAIN LANGUAGE: migration 060 closed the eight seat-moving service-role-only functions. These six have the same exposure (the
-- migrations only said "grant execute ... to service_role", which keeps nobody else out; see RESUME-STRIPE.md section 11) but do not
-- move seat counters, so 060 left them as optional part E. Each is called only with the service-role key (Stripe webhook, daily cron):
--   apply_queued_referral_if_any(uuid), credit_referral_if_earned(uuid), reverse_referral_if_refunded(uuid)   referral rewards (webhook)
--   record_payment_alert(text,text,numeric,text,text)                                                         payment alerts (webhook / cron)
--   record_payment_failed(text,numeric,text)                                                                  invoice.payment_failed (webhook)
--   record_subscription_payment_succeeded(text,numeric,text,timestamptz,text)                                 invoice.payment_succeeded (webhook)
-- After this, anon and signed-in users get "permission denied" for them; service_role keeps working.
-- Rollback for one function, if a webhook ever starts returning permission errors:
--   grant execute on function public.<name>(<arguments>) to service_role;      (service_role must always keep it)

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public.apply_queued_referral_if_any(uuid)',
    'public.credit_referral_if_earned(uuid)',
    'public.record_payment_alert(text,text,numeric,text,text)',
    'public.record_payment_failed(text,numeric,text)',
    'public.record_subscription_payment_succeeded(text,numeric,text,timestamptz,text)',
    'public.reverse_referral_if_refunded(uuid)'
  ] loop
    if to_regprocedure(v_sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', v_sig);
      execute format('grant execute on function %s to service_role', v_sig);
      raise notice 'service-role only: %', v_sig;
    else
      raise notice 'skipped (does not exist): %', v_sig;
    end if;
  end loop;
end
$$;
