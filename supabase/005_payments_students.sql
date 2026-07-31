-- French Punjabi — Manual Interac e-Transfer payments + Students
-- Run this once in the Supabase SQL Editor, after 001_schema.sql / 002 / 003
-- (004 is unrelated batch-slots work and can run in any order relative to
-- this file). Safe to re-run (uses if not exists / or replace / drop-then-
-- create for the two functions whose return type changes).
--
-- Payment is never processed on this site. A student submits an enrollment
-- application (status NEW, payment_status PENDING), is shown Interac
-- e-Transfer instructions, and pays hiteshsharma2454@gmail.com separately.
-- An authorized admin manually confirms the transfer arrived; that single
-- confirmation flips payment_status -> PAID, status -> ENROLLED, and
-- creates the matching row in public.students — all inside one
-- security-definer function so it is atomic and safe to click/refresh
-- twice (see public.confirm_enrollment_payment below).

-- =========================================================
-- enrollments — payment tracking columns
-- =========================================================

alter table public.enrollments add column if not exists enrollment_ref text;
alter table public.enrollments add column if not exists payment_status text not null default 'PENDING';
alter table public.enrollments add column if not exists payment_mode text;
alter table public.enrollments add column if not exists amount_due numeric(10, 2) not null default 0;
alter table public.enrollments add column if not exists currency text not null default 'CAD';
alter table public.enrollments add column if not exists paid_at timestamptz;
alter table public.enrollments add column if not exists confirmed_by uuid references public.admin_users (id) on delete set null;

-- Backfill any pre-existing rows (created before this migration) with a
-- unique reference so the NOT NULL + UNIQUE constraints below can apply.
-- New rows always set this themselves at insert time.
update public.enrollments
set enrollment_ref = 'FP-' || extract(year from created_at)::text || '-' || upper(substr(md5(id::text), 1, 6))
where enrollment_ref is null;

alter table public.enrollments alter column enrollment_ref set not null;

alter table public.enrollments drop constraint if exists enrollments_enrollment_ref_key;
alter table public.enrollments add constraint enrollments_enrollment_ref_key unique (enrollment_ref);

alter table public.enrollments drop constraint if exists enrollments_payment_status_check;
alter table public.enrollments add constraint enrollments_payment_status_check
  check (payment_status in ('PENDING', 'PAID'));

alter table public.enrollments drop constraint if exists enrollments_payment_mode_check;
alter table public.enrollments add constraint enrollments_payment_mode_check
  check (payment_mode is null or payment_mode in ('full', 'monthly'));

create index if not exists enrollments_payment_status_idx on public.enrollments (payment_status);

-- A crafted anon insert must not be able to start life already PAID, on
-- top of the existing NEW / pending-email requirement.
drop policy if exists "enrollments_public_insert" on public.enrollments;
create policy "enrollments_public_insert" on public.enrollments
  for insert to anon, authenticated
  with check (status = 'NEW' and confirmation_email_status = 'pending' and payment_status = 'PENDING');

-- =========================================================
-- students — created only via confirm_enrollment_payment() below, never
-- directly by a client. One row per enrollment (enforced by the unique
-- constraint, which also backs the idempotent ON CONFLICT in that
-- function).
-- =========================================================

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments (id) on delete cascade,

  full_name text not null,
  email text not null,
  phone text not null,
  country text not null,

  phase_id uuid references public.phases (id) on delete set null,
  level_id uuid references public.levels (id) on delete set null,
  batch_id uuid references public.batches (id) on delete set null,
  phase_name text not null,
  level_name text,
  batch_timing text not null,

  enrollment_ref text not null,
  status text not null default 'ACTIVE',

  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint students_status_check check (status in ('ACTIVE', 'INACTIVE'))
);

create index if not exists students_enrolled_at_idx on public.students (enrolled_at desc);
create index if not exists students_email_idx on public.students (email);

drop trigger if exists set_updated_at on public.students;
create trigger set_updated_at before update on public.students
  for each row execute function public.set_updated_at();

alter table public.students enable row level security;

drop policy if exists "students_admin_select" on public.students;
create policy "students_admin_select" on public.students
  for select using (public.is_admin());

drop policy if exists "students_admin_write" on public.students;
create policy "students_admin_write" on public.students
  for all using (public.is_admin()) with check (public.is_admin());

-- No anon grant at all — students only ever appear via the security-definer
-- function, which bypasses RLS/grants as its owning role.
grant select, insert, update, delete on public.students to authenticated;

-- =========================================================
-- Duplicate-submission check — widened to also return the fields the
-- payment-instructions screen needs (ref/amount/currency/name) so a
-- resubmitted form still shows the student their original reference
-- instead of erroring. Same narrow scope as before (email + batch/offer +
-- 2 minute window); still tells an anon caller nothing about any other
-- enrollment.
-- =========================================================

drop function if exists public.enrollment_recent_duplicate(text, uuid, text);

create function public.enrollment_recent_duplicate(
  p_email text,
  p_batch_id uuid,
  p_program_offer_key text
) returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', id,
    'enrollment_ref', enrollment_ref,
    'amount_due', amount_due,
    'currency', currency,
    'full_name', full_name
  )
  from public.enrollments
  where email = p_email
    and batch_id is not distinct from p_batch_id
    and program_offer_key is not distinct from p_program_offer_key
    and created_at > now() - interval '2 minutes'
  order by created_at desc
  limit 1;
$$;

grant execute on function public.enrollment_recent_duplicate(text, uuid, text) to anon, authenticated;

-- =========================================================
-- confirm_enrollment_payment — the ONLY way payment_status ever becomes
-- PAID. Callable only by an authenticated admin session (checked via
-- is_admin() below, not just a hidden button); performs the PENDING->PAID
-- + NEW->ENROLLED transition and the students insert in one transaction
-- with a row lock, so a double-click or page refresh can never create a
-- duplicate student, send a duplicate email, or double-assign a batch.
-- The caller (server action) uses `just_confirmed` to decide whether to
-- send the "Enrollment Confirmed" email — false on any repeat call.
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
    enrollment_id, full_name, email, phone, country,
    phase_id, level_id, batch_id, phase_name, level_name, batch_timing,
    enrollment_ref
  )
  values (
    v_enrollment.id, v_enrollment.full_name, v_enrollment.email, v_enrollment.phone, v_enrollment.country,
    v_enrollment.phase_id, v_enrollment.level_id, v_enrollment.batch_id,
    v_enrollment.phase_name, v_enrollment.level_name, v_enrollment.batch_timing,
    v_enrollment.enrollment_ref
  )
  on conflict (enrollment_id) do nothing
  returning id into v_student_id;

  if v_student_id is null then
    select id into v_student_id from public.students where enrollment_id = v_enrollment.id;
  end if;

  return jsonb_build_object(
    'just_confirmed', v_just_confirmed,
    'student_id', v_student_id,
    'enrollment', to_jsonb(v_enrollment)
  );
end;
$$;

grant execute on function public.confirm_enrollment_payment(uuid) to authenticated;
