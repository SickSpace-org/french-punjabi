-- French Punjabi — Weekly mock test slots
-- Run this once in the Supabase SQL Editor, after 022_one_on_one_testing_offer.sql.
--
-- A short (default 15min) mock test slot the admin schedules every Friday —
-- separate from a batch's regular class schedule (batches.class_days/
-- class_time, see 019_attendance_time_window_and_admin_override.sql).
-- Always Friday by design, so there's no day_of_week column to manage; the
-- admin only sets the time, duration, and meeting link. Visible to every
-- signed-in student (it's not tied to a particular batch/enrollment), same
-- "active rows only" shape as program_offers.

create table if not exists public.test_slots (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Mock Test',
  start_time time not null,
  duration_minutes int not null default 15,
  meeting_link text,
  note text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.test_slots;
create trigger set_updated_at before update on public.test_slots for each row execute function public.set_updated_at();

alter table public.test_slots enable row level security;

drop policy if exists "test_slots_student_select" on public.test_slots;
create policy "test_slots_student_select" on public.test_slots
  for select using (is_active = true or public.is_admin());

drop policy if exists "test_slots_admin_write" on public.test_slots;
create policy "test_slots_admin_write" on public.test_slots
  for all using (public.is_admin()) with check (public.is_admin());
