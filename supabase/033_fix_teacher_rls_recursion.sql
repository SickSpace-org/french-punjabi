-- French Punjabi — Fixes "infinite recursion detected in policy" on
-- batches/students, introduced by 032_teacher_batch_access.sql. Run after
-- 032_teacher_batch_access.sql.
--
-- Root cause: current_teacher_id() and student_current_batch_id() were
-- defined as `language sql`. Postgres is allowed to INLINE simple
-- `language sql` functions directly into the query that calls them, as a
-- planner optimization. When a SECURITY DEFINER `language sql` function
-- gets inlined into an RLS policy's USING clause, its privilege-bypass
-- boundary can be lost in the inlining — the nested table read then
-- becomes subject to that table's RLS again, inside the very statement
-- that's already evaluating it, which Postgres reports as "infinite
-- recursion detected in policy" (verified: this reproduced reliably on a
-- direct `select from batches` as a real teacher session, confirmed via
-- an end-to-end RLS test suite with real auth sessions before this fix,
-- and confirmed gone after it).
--
-- Fix: `language plpgsql` functions are NEVER inlined by the planner, so
-- their SECURITY DEFINER context always holds. Every teacher-scoping
-- helper used INSIDE another table's RLS policy is redefined here as
-- plpgsql instead of sql. students_teacher_select's inline
-- `exists (select ... from batches ...)` is also moved into its own
-- dedicated security-definer function (student_is_in_teacher_batch),
-- mirroring how has_course_access() already wraps every other cross-table
-- RLS check in this codebase — no policy anywhere else inlines a raw
-- cross-table subquery directly, and this one shouldn't have either.
--
-- teacher_batch_roster() (030) is untouched — it's only ever called as a
-- top-level RPC, never referenced from inside another table's policy, and
-- the end-to-end test suite confirms it already works correctly.

create or replace function public.current_teacher_id()
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return (select id from public.teachers where auth_user_id = auth.uid() and status = 'ACTIVE');
end;
$$;

create or replace function public.is_active_teacher()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.teachers
    where auth_user_id = auth.uid() and status = 'ACTIVE'
  );
end;
$$;

create or replace function public.student_current_batch_id(p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return (
    select batch_id
    from public.enrollments
    where student_id = p_student_id and batch_id is not null
    order by created_at desc
    limit 1
  );
end;
$$;

-- New — replaces students_teacher_select's old inline exists(...) with a
-- proper security-definer wrapper (see rationale above).
create or replace function public.student_is_in_teacher_batch(p_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1 from public.batches b
    where b.id = public.student_current_batch_id(p_student_id)
      and b.teacher_id = public.current_teacher_id()
  );
end;
$$;

grant execute on function public.student_is_in_teacher_batch(uuid) to authenticated;

drop policy if exists "students_teacher_select" on public.students;
create policy "students_teacher_select" on public.students
  for select using (
    status = 'ACTIVE' and public.student_is_in_teacher_batch(students.id)
  );
