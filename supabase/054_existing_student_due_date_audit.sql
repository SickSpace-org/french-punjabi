-- French Punjabi — Checkpoint 3: audited due-date edits.
--
-- PLAIN LANGUAGE: pure addition — one new function, no existing column,
-- constraint, RLS policy, or function is touched. Safe to re-run.
--
-- admin_set_existing_student_due_date — replaces the plain, unaudited
-- `.update()` the Billing page's single-row edit and CSV import both used
-- before: logs every due-date change to payment_events (event_type
-- 'manual_expiry_edit', already a valid value from this project's
-- existing check constraint — not new), with WHO made it (auth.uid()) and
-- the old -> new value. Refuses a student who isn't classified 'monthly'
-- (same "excluded until classified" rule as everything else in this
-- feature — migration 052's existing_student_lifecycle_eligible and
-- migration 051's settle_existing_student_payment both already enforce
-- this at the database layer, not just the UI; this is the third write
-- path for an existing student's due date, so it gets the same check).
-- is_admin()-gated.

create or replace function public.admin_set_existing_student_due_date(
  p_student_id uuid,
  p_next_payment_due date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_payment_mode text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;
  if v_student.stripe_subscription_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'stripe_managed_student');
  end if;

  select payment_mode into v_payment_mode from public.enrollments
    where student_id = p_student_id
    order by created_at desc
    limit 1;
  if v_payment_mode is distinct from 'monthly' then
    return jsonb_build_object('ok', false, 'reason', 'not_monthly');
  end if;

  update public.students
  set next_payment_due = p_next_payment_due,
      next_payment_due_needs_review = false
  where id = p_student_id;

  insert into public.payment_events (student_id, event_type, created_by, note)
  values (
    p_student_id, 'manual_expiry_edit', auth.uid(),
    'Due date changed: ' || coalesce(v_student.next_payment_due::text, '(none)') || ' -> ' || coalesce(p_next_payment_due::text, '(none)')
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_set_existing_student_due_date(uuid, date) to authenticated;
