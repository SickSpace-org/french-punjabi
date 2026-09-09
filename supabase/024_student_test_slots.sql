-- French Punjabi — Per-student Friday test slots
-- Run this once in the Supabase SQL Editor, after 023_test_slots.sql.
--
-- test_slots (023) is one shared time for every student. This adds
-- student_test_slots: the admin instead assigns EACH student their own
-- Friday test time + meeting link individually (e.g. staggering students
-- across the afternoon) — shown on that student's own dashboard card and
-- new "Test" portal page. Both tables stay; nothing from 023 is removed or
-- changed.

create table if not exists public.student_test_slots (
  student_id uuid primary key references public.students(id) on delete cascade,
  /** Exact local (America/Toronto) start time, "HH:MM:SS" — always a Friday. */
  start_time time not null,
  meeting_link text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.student_test_slots;
create trigger set_updated_at before update on public.student_test_slots for each row execute function public.set_updated_at();

alter table public.student_test_slots enable row level security;

-- A student may read only their own assigned slot — same
-- "own row via students.auth_user_id" pattern as batches_self_select
-- (018_batches_self_select.sql).
drop policy if exists "student_test_slots_self_select" on public.student_test_slots;
create policy "student_test_slots_self_select" on public.student_test_slots
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.students s
      where s.id = student_test_slots.student_id and s.auth_user_id = auth.uid()
    )
  );

drop policy if exists "student_test_slots_admin_write" on public.student_test_slots;
create policy "student_test_slots_admin_write" on public.student_test_slots
  for all using (public.is_admin()) with check (public.is_admin());
