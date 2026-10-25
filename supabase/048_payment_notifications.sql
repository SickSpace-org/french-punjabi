-- French Punjabi — Checkpoint 2, Notifications (A8).
--
-- PLAIN LANGUAGE: this file is pure addition plus one bug fix in an
-- existing function's BODY (not its signature, columns, or RLS policies).
--
--   1. NEW table `payment_notifications` — one row per in-portal
--      notification a student sees on the Notifications page (payment
--      succeeded/failed, trial ending soon, renewal coming up, access
--      paused/revoked for non-payment, referral reward earned). Brand new
--      table, RLS copied from the existing teacher_messages pattern
--      (students can only ever see/update their OWN rows via
--      is_own_student_id(), which already exists and is unchanged).
--      Cannot affect any existing student or any existing table.
--
--   2. BUG FIX in handle_subscription_canceled (customer.subscription.
--      deleted): makes it a no-op when the student is already INACTIVE,
--      instead of releasing the batch seat a second time. Found while
--      wiring up the new "access revoked" notification below — the day-14
--      sweep (run_payment_lifecycle_sweep) and admin_deactivate_student
--      both already set the student to INACTIVE and release the seat
--      themselves, THEN separately ask Stripe to cancel the subscription.
--      That Stripe cancellation fires this exact webhook a moment later,
--      and until now it had no way to know the seat was already released,
--      so it released it AGAIN (filled_slots off by one low, permanently,
--      every single time a Stripe-subscribed student is deactivated this
--      way). This only changes what happens for a student already
--      INACTIVE at the moment this specific webhook arrives — every
--      student not in that exact situation (which includes every current
--      student with no Stripe data) is completely unaffected. Safe to
--      re-run (create or replace).
--
-- Safe to re-run — every statement is idempotent (drop-if-exists / create
-- or replace / create table if not exists).

-- =========================================================
-- 1. handle_subscription_canceled — idempotency fix.
-- =========================================================

create or replace function public.handle_subscription_canceled(
  p_stripe_subscription_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_enrollment public.enrollments%rowtype;
begin
  select * into v_student from public.students where stripe_subscription_id = p_stripe_subscription_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  -- Already handled by admin_deactivate_student or the day-14 sweep —
  -- those already set INACTIVE and released the seat themselves before
  -- asking Stripe to cancel, which is what triggers this very webhook.
  -- Without this check the seat below gets released a second time.
  if v_student.status = 'INACTIVE' then
    update public.students set subscription_status = 'canceled' where id = v_student.id;
    return jsonb_build_object('ok', true, 'student_id', v_student.id, 'already_inactive', true);
  end if;

  select * into v_enrollment from public.enrollments
    where student_id = v_student.id and payment_mode = 'subscription'
    order by created_at desc
    limit 1
    for update;

  update public.students
  set status = 'INACTIVE',
      subscription_status = 'canceled'
  where id = v_student.id;

  if v_enrollment.batch_id is not null then
    update public.batches set filled_slots = greatest(filled_slots - 1, 0) where id = v_enrollment.batch_id;
  end if;

  insert into public.payment_events (student_id, enrollment_id, event_type, note)
  values (v_student.id, v_enrollment.id, 'subscription_canceled', 'customer.subscription.deleted — seat released');

  return jsonb_build_object('ok', true, 'student_id', v_student.id, 'batch_id', v_enrollment.batch_id, 'already_inactive', false);
end;
$$;

grant execute on function public.handle_subscription_canceled(text) to service_role;

-- =========================================================
-- 2. payment_notifications — new table.
-- =========================================================

create table if not exists public.payment_notifications (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  kind        text not null check (kind in (
    'payment_succeeded', 'payment_failed', 'renewal_upcoming',
    'trial_ending', 'access_suspended', 'access_revoked', 'referral_reward'
  )),
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists payment_notifications_student_id_idx on public.payment_notifications (student_id, created_at desc);

alter table public.payment_notifications enable row level security;

drop policy if exists "payment_notifications_student_select" on public.payment_notifications;
create policy "payment_notifications_student_select" on public.payment_notifications
  for select using (public.is_own_student_id(student_id));

drop policy if exists "payment_notifications_student_update" on public.payment_notifications;
create policy "payment_notifications_student_update" on public.payment_notifications
  for update using (public.is_own_student_id(student_id)) with check (public.is_own_student_id(student_id));

drop policy if exists "payment_notifications_admin_select" on public.payment_notifications;
create policy "payment_notifications_admin_select" on public.payment_notifications
  for select using (public.is_admin());
