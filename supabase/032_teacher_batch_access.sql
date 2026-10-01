-- French Punjabi — Teacher Portal, Phase 2: lets an ACTIVE teacher see
-- only their own assigned batch(es) and the students currently enrolled
-- in them — nothing else. Run after 031_teachers.sql.
--
-- Column-level safety, spelled out: `students` carries NO payment/pricing
-- columns at all (checked the schema before writing this migration), so a
-- plain row-level SELECT policy on it is safe on its own — there is
-- nothing sensitive on that table to leak. `enrollments` DOES carry
-- amount_due/payment_status/paid_at/confirmed_by. Teachers get ZERO RLS
-- policy on `enrollments` in this migration, full stop — its only
-- existing select policy (enrollments_admin_select, see
-- 003_enrollments.sql) already requires is_admin(), and a teacher is not
-- an admin, so that table was already unreachable to a teacher's session
-- before this migration and stays that way. The one thing a teacher
-- legitimately needs from enrollments — a student's course label
-- (phase/level/batch text) — comes through teacher_batch_roster() below,
-- a narrow security-definer function that reads enrollments internally
-- (bypassing RLS, same pattern as confirm_enrollment_payment()) but
-- returns only the safe columns: name, email, phone, country, and course
-- label. Never amount_due, payment_status, currency, paid_at, or any
-- other enrollments column. The teacher portal reads through this
-- function exclusively — it is never given direct table access to
-- `enrollments`.
--
-- Nothing here touches any existing admin_users/students/enrollments
-- policy — every policy added below is a NEW, additive one. Postgres ORs
-- same-command policies together, so admin and student access are
-- byte-for-byte unchanged.

-- =========================================================
-- student_current_batch_id() — ports the "most recent enrollment with a
-- batch_id" convention (already used everywhere in TypeScript:
-- getAdminStudents.ts, getAdminAttendance.ts, getStudentDetail.ts,
-- swapBatch()) into SQL, so RLS can apply the exact same rule a teacher's
-- roster follows: a student who has since moved to a different
-- batch/teacher stops appearing here immediately, the same way they stop
-- being "current" for admin.
-- =========================================================

create or replace function public.student_current_batch_id(p_student_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select batch_id
  from public.enrollments
  where student_id = p_student_id and batch_id is not null
  order by created_at desc
  limit 1;
$$;

grant execute on function public.student_current_batch_id(uuid) to authenticated;

-- =========================================================
-- batches: a teacher may see their own assigned batch(es) — additive to
-- the existing batches_public_select/batches_admin_write policies
-- (001_schema.sql), which are untouched.
-- =========================================================

drop policy if exists "batches_teacher_select" on public.batches;
create policy "batches_teacher_select" on public.batches
  for select using (teacher_id = public.current_teacher_id());

-- =========================================================
-- students: a teacher may see only ACTIVE students whose CURRENT batch
-- (per student_current_batch_id above) is one of their own assigned
-- batches. Additive to students_admin_select/students_admin_write
-- (005_payments_students.sql) and students_self_select
-- (006_student_accounts.sql), all untouched. Safe as a plain row-level
-- policy because `students` has no payment/pricing columns to leak.
-- =========================================================

drop policy if exists "students_teacher_select" on public.students;
create policy "students_teacher_select" on public.students
  for select using (
    status = 'ACTIVE'
    and exists (
      select 1 from public.batches b
      where b.id = public.student_current_batch_id(students.id)
        and b.teacher_id = public.current_teacher_id()
    )
  );

-- =========================================================
-- teacher_batch_roster() — the ONLY way a teacher ever sees course-label
-- text (phase/level/batch), which lives on enrollments. Returns just
-- enough to render a roster row — never a payment/pricing column. The
-- batch-ownership check is INSIDE the function, not left to the caller,
-- so a teacher can't probe another teacher's batch_id just by knowing or
-- guessing it — calling this with someone else's batch_id returns zero
-- rows, not an error and not their roster.
--
-- Uses a LATERAL join (not a call to student_current_batch_id) so each
-- student contributes at most one row even if they have multiple
-- enrollment rows pointing at this same batch — the join picks exactly
-- the single most-recent, batch-bearing enrollment per student, same
-- "skip nulls, most recent first" rule as student_current_batch_id above.
-- =========================================================

create or replace function public.teacher_batch_roster(p_batch_id uuid)
returns table (
  student_id uuid,
  full_name text,
  email text,
  phone text,
  country text,
  phase_name text,
  level_name text,
  batch_timing text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.full_name, s.email, s.phone, s.country,
         e.phase_name, e.level_name, e.batch_timing
  from public.students s
  cross join lateral (
    select e2.batch_id, e2.phase_name, e2.level_name, e2.batch_timing
    from public.enrollments e2
    where e2.student_id = s.id and e2.batch_id is not null
    order by e2.created_at desc
    limit 1
  ) e
  where s.status = 'ACTIVE'
    and e.batch_id = p_batch_id
    and exists (
      select 1 from public.batches b
      where b.id = p_batch_id and b.teacher_id = public.current_teacher_id()
    );
$$;

grant execute on function public.teacher_batch_roster(uuid) to authenticated;
