-- French Punjabi — Admin-editable student status + re-enrollment timing
-- Run this once in the Supabase SQL Editor, after 013_student_portal_access_link.sql.
--
-- One change (the app's editable-status dropdown itself needs no new SQL —
-- it does a plain `.update({ status })` on students, same as the existing
-- suspendStudent/reactivateStudent actions, already allowed by the
-- students_admin_write RLS policy for any is_admin() session):
--
-- confirm_enrollment_payment(): 006_student_accounts.sql already dedupes
--    students by email (on conflict (email_key) do update) so a second
--    enrollment for the same email never creates a second student row —
--    but it never refreshed enrolled_at, so the Students tab kept showing
--    the ORIGINAL enrollment date even after someone re-enrolled. Now the
--    upsert also bumps enrolled_at to the moment the new enrollment's
--    payment is confirmed, which is what "just change the timing of
--    enrollment, don't duplicate the student" means in practice — the
--    enrollments tab still keeps every enrollment application as its own
--    row (nothing there is ever deleted or merged).

create or replace function public.confirm_enrollment_payment(p_enrollment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments%rowtype;
  v_student_id uuid;
  v_just_confirmed boolean := false;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;

  if not found then
    raise exception 'enrollment not found';
  end if;

  if v_enrollment.payment_status <> 'PAID' then
    update public.enrollments
    set payment_status = 'PAID',
        status = 'ENROLLED',
        paid_at = now(),
        confirmed_by = auth.uid()
    where id = p_enrollment_id
    returning * into v_enrollment;

    v_just_confirmed := true;
  end if;

  insert into public.students (
    enrollment_id, full_name, email, phone, country, enrollment_ref
  )
  values (
    v_enrollment.id, v_enrollment.full_name, v_enrollment.email, v_enrollment.phone,
    v_enrollment.country, v_enrollment.enrollment_ref
  )
  on conflict (email_key) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        country = excluded.country,
        enrolled_at = now()
  returning id into v_student_id;

  update public.enrollments set student_id = v_student_id where id = p_enrollment_id;

  return jsonb_build_object(
    'just_confirmed', v_just_confirmed,
    'student_id', v_student_id,
    'enrollment', to_jsonb(v_enrollment)
  );
end;
$$;

grant execute on function public.confirm_enrollment_payment(uuid) to authenticated;
