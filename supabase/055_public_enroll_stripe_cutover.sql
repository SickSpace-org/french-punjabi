-- French Punjabi — public Enroll-page Stripe cutover (behind a flag, off
-- by default).
--
-- PLAIN LANGUAGE: pure addition — one new function, no existing column,
-- constraint, RLS policy, or function is touched. Nothing here runs
-- automatically and nothing changes for the existing manual Interac flow
-- (confirm_enrollment_payment, untouched) or the existing Stripe
-- subscription flow (activate_subscription_enrollment, untouched) — this
-- only adds the missing piece: a NEW student paying the "Full" program
-- price once via Stripe (no trial, no recurring subscription), which
-- didn't have an activation path before. Safe to re-run.
--
-- activate_full_payment_enrollment mirrors activate_subscription_enrollment
-- (hold lookup, capacity release, seat fill) but deliberately leaves
-- stripe_subscription_id, subscription_status, locked_price, locked_currency,
-- and next_payment_due_at all null — a one-time payment has no renewal to
-- track, so this student ends up looking exactly like one created through
-- today's manual 'full' flow (confirm_enrollment_payment), just with
-- stripe_customer_id set for traceability and reached via Stripe instead
-- of an admin manually confirming an e-Transfer. No trial-dedupe check
-- (that rule exists only to stop free-trial abuse; nothing is free here).

create or replace function public.activate_full_payment_enrollment(
  p_hold_id uuid,
  p_enrollment_id uuid,
  p_stripe_customer_id text,
  p_amount numeric,
  p_currency text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold public.batch_seat_holds%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_student_id uuid;
begin
  select * into v_hold from public.batch_seat_holds where id = p_hold_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_hold');
  end if;

  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;

  if not found then
    raise exception 'enrollment % not found', p_enrollment_id;
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
    enrollment_id, full_name, email, phone, country, enrollment_ref, stripe_customer_id
  )
  values (
    v_enrollment.id, v_enrollment.full_name, v_enrollment.email, v_enrollment.phone,
    v_enrollment.country, v_enrollment.enrollment_ref, p_stripe_customer_id
  )
  on conflict (email_key) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        country = excluded.country,
        stripe_customer_id = excluded.stripe_customer_id
  returning id into v_student_id;

  update public.enrollments set student_id = v_student_id where id = p_enrollment_id;

  delete from public.batch_seat_holds where id = p_hold_id;

  update public.batches
  set held_slots = greatest(held_slots - 1, 0),
      filled_slots = filled_slots + 1
  where id = v_hold.batch_id;

  insert into public.payment_events (student_id, enrollment_id, event_type, amount, currency, note)
  values (v_student_id, p_enrollment_id, 'payment_succeeded', p_amount, p_currency, 'Public Enroll cutover: one-time full payment via Stripe');

  return jsonb_build_object('ok', true, 'student_id', v_student_id);
end;
$$;

grant execute on function public.activate_full_payment_enrollment(uuid, uuid, text, numeric, text) to service_role;
