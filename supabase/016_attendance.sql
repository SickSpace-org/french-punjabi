-- French Punjabi — Class attendance: meeting links + weekly schedule + auto-Present on join
-- Run this once in the Supabase SQL Editor, after 015_student_fee_reminder.sql.
--
-- Admin pastes a meeting link and picks which weekdays a batch meets, once,
-- on the batch itself (meeting_link + class_days below). The student
-- portal's "Join Class" button opens that link AND calls
-- mark_class_attendance(), which records today's date as Present for
-- their current batch — but only if today is actually one of that batch's
-- scheduled weekdays, so clicking on a non-class day (or a batch nobody
-- assigned) does nothing.
--
-- Absence is never stored as its own row: the admin's attendance grid (see
-- getAdminAttendance.ts) computes it by comparing every scheduled class
-- date in a rolling window against which dates have an attendance row for
-- that student — present if a row exists, absent otherwise. Same logic
-- powers the student's own history view.

alter table public.batches add column if not exists meeting_link text;
-- 0=Sunday .. 6=Saturday, matching Postgres extract(dow from ...) and JS Date#getDay().
alter table public.batches add column if not exists class_days smallint[] not null default '{}';

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  batch_id uuid not null references public.batches (id) on delete cascade,
  class_date date not null,
  joined_at timestamptz not null default now(),
  constraint attendance_unique unique (student_id, batch_id, class_date)
);

create index if not exists attendance_student_id_idx on public.attendance (student_id);
create index if not exists attendance_batch_date_idx on public.attendance (batch_id, class_date);

alter table public.attendance enable row level security;

drop policy if exists "attendance_admin_select" on public.attendance;
create policy "attendance_admin_select" on public.attendance
  for select using (public.is_admin());

drop policy if exists "attendance_self_select" on public.attendance;
create policy "attendance_self_select" on public.attendance
  for select using (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id and s.auth_user_id = auth.uid()
    )
  );

-- No insert/update/delete grants to anon/authenticated at all — every row
-- is written exclusively by mark_class_attendance() below, which runs as
-- security definer and re-derives the caller's own student_id server-side
-- (never trusts a student_id passed in), so a student can never mark
-- attendance for anyone but themselves, or backdate/forge a class_date.

create or replace function public.mark_class_attendance(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_class_days smallint[];
  v_dow smallint := extract(dow from now())::smallint;
  v_inserted_id uuid;
begin
  select id into v_student_id
  from public.students
  where auth_user_id = auth.uid() and status = 'ACTIVE';

  if v_student_id is null then
    raise exception 'not an active student';
  end if;

  select class_days into v_class_days from public.batches where id = p_batch_id;

  if v_class_days is null then
    raise exception 'batch not found';
  end if;

  if not (v_dow = any(v_class_days)) then
    return jsonb_build_object('ok', false, 'reason', 'not_a_class_day');
  end if;

  insert into public.attendance (student_id, batch_id, class_date)
  values (v_student_id, p_batch_id, current_date)
  on conflict (student_id, batch_id, class_date) do nothing
  returning id into v_inserted_id;

  return jsonb_build_object('ok', true, 'already_marked', v_inserted_id is null);
end;
$$;

grant execute on function public.mark_class_attendance(uuid) to authenticated;
