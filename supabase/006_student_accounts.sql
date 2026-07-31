-- French Punjabi — Student accounts: dedupe by email, decouple from enrollment
-- Run this once in the Supabase SQL Editor (or via the same direct-Postgres
-- method used for 005), after 005_payments_students.sql.
--
-- Today `students.enrollment_id` is UNIQUE — one students row per
-- *enrollment*, not per *person*. That breaks "one student may have
-- multiple assigned courses, never a second login account" — a second
-- enrollment for the same email would create a second account. This
-- migration makes `students` a deduplicated person/account record keyed by
-- normalized email, moves per-enrollment fields off it (they become
-- properties of student_course_access in 007), adds the Supabase Auth
-- linkage column, and updates confirm_enrollment_payment() to upsert by
-- email instead of inserting per enrollment.

-- =========================================================
-- 1. Merge any existing duplicate-email rows BEFORE the unique constraint
--    can be added. Keeps the earliest-enrolled row per normalized email,
--    deletes the rest. Nothing else references students.id yet (no
--    student_course_access table exists until 007), so this is safe.
-- =========================================================

do $$
declare
  dup record;
begin
  for dup in
    select lower(trim(email)) as email_key, count(*) as n
    from public.students
    group by lower(trim(email))
    having count(*) > 1
  loop
    raise notice 'Merging % duplicate students rows for email_key=%', dup.n, dup.email_key;
  end loop;
end $$;

delete from public.students s
using (
  select id,
         row_number() over (
           partition by lower(trim(email)) order by enrolled_at asc, created_at asc
         ) as rn
  from public.students
) ranked
where s.id = ranked.id
  and ranked.rn > 1;

-- =========================================================
-- 2. Normalize + dedupe key, drop the old per-enrollment uniqueness.
-- =========================================================

alter table public.students add column if not exists email_key text
  generated always as (lower(trim(email))) stored;

alter table public.students drop constraint if exists students_enrollment_id_key;

alter table public.students drop constraint if exists students_email_key_key;
alter table public.students add constraint students_email_key_key unique (email_key);

-- =========================================================
-- 3. Auth linkage + drop per-enrollment columns (moving to
--    student_course_access in 007_course_content.sql).
-- =========================================================

alter table public.students add column if not exists auth_user_id uuid unique references auth.users (id);

-- The original check only allowed ACTIVE/INACTIVE; the portal's
-- suspend/reactivate flow (section 25) uses SUSPENDED specifically, so
-- widen the allowed set rather than repurpose INACTIVE.
alter table public.students drop constraint if exists students_status_check;
alter table public.students add constraint students_status_check
  check (status in ('ACTIVE', 'INACTIVE', 'SUSPENDED'));

alter table public.students drop column if exists phase_id;
alter table public.students drop column if exists level_id;
alter table public.students drop column if exists batch_id;
alter table public.students drop column if exists phase_name;
alter table public.students drop column if exists level_name;
alter table public.students drop column if exists batch_timing;

create index if not exists students_email_key_idx on public.students (email_key);
create index if not exists students_auth_user_id_idx on public.students (auth_user_id);

-- =========================================================
-- 4. Forward pointer from every enrollment to its (deduplicated) student
--    account — students.enrollment_id now only ever means "first
--    enrollment"; this is how 2nd/3rd enrollments find their account.
-- =========================================================

alter table public.enrollments add column if not exists student_id uuid references public.students (id);

-- Backfill: enrollments already marked PAID before this migration existed
-- were confirmed by the OLD confirm_enrollment_payment() (which never set
-- student_id). Link them now by matching email — safe/idempotent, only
-- ever fills in NULLs.
update public.enrollments e
set student_id = s.id
from public.students s
where e.student_id is null
  and e.payment_status = 'PAID'
  and lower(trim(e.email)) = s.email_key;

-- =========================================================
-- 5. students_self_select — a suspended student must still be able to see
--    their OWN row (to render "your account is suspended"), even though
--    is_active_student() below requires status = 'ACTIVE'. This is new:
--    students previously had admin-only select.
-- =========================================================

drop policy if exists "students_self_select" on public.students;
create policy "students_self_select" on public.students
  for select using (auth_user_id = auth.uid());

-- =========================================================
-- 6. is_active_student() — mirrors is_admin() exactly. Used by RLS on
--    course content / progress / comments / notifications tables.
-- =========================================================

create or replace function public.is_active_student()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.students
    where auth_user_id = auth.uid() and status = 'ACTIVE'
  );
$$;

grant execute on function public.is_active_student() to authenticated;

-- =========================================================
-- 7. confirm_enrollment_payment() — upsert students by email_key instead
--    of inserting per enrollment; never touches status (a SUSPENDED
--    account must not silently reactivate just because a new enrollment
--    got paid); also stamps enrollments.student_id on every call so a
--    2nd/3rd enrollment can still find its (shared) account even though
--    students.enrollment_id keeps pointing at the first one only.
-- =========================================================

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
        country = excluded.country
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
