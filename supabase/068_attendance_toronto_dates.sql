-- French Punjabi — Attendance: use Toronto dates for check-in, repair misdated rows
-- Run this once in the Supabase SQL Editor, after 067_personalised_one_on_one.sql.
--
-- The bug: mark_class_attendance() (019) checked the ±30 min window in
-- America/Toronto, but took the weekday (extract(dow from now())) and the
-- saved class_date (current_date) from the database clock, which is UTC.
-- An evening class in Toronto is already the next day in UTC (8 PM EST =
-- 1 AM UTC), so a student clicking "Join Class" for a Monday 8 PM class was
-- checked against Tuesday:
--   * if Tuesday isn't a class day → "Today isn't a scheduled class day",
--     nothing saved, the student shows Absent;
--   * if it is → the row was saved as Tuesday, so Monday shows Absent.
-- Since clocks went back on Nov 1 (EDT → EST) this hits every class from
-- 7 PM Toronto onward, and by now the whole 28-day history window falls after
-- that date, which is why every recent class reads Absent.
--
-- 1. mark_class_attendance() now works out the class date in Toronto: the
--    batch's class_time occurrence (yesterday / today / tomorrow) closest to
--    now, so a check-in a few minutes after midnight for an 11:45 PM class
--    still counts for the right day. Without class_time it's today's Toronto
--    date.
-- 2. Existing check-in rows that were saved under the UTC date are moved to
--    the Toronto class date (or dropped if that date already has a row).
--    Check-ins that were rejected outright left no row and can't be
--    recovered. Mark those Present by hand on the student's attendance grid.

create or replace function public.mark_class_attendance(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_class_days smallint[];
  v_class_time time;
  v_now_local timestamp := now() at time zone 'America/Toronto';
  v_class_date date;
  v_diff_seconds numeric;
  v_inserted_id uuid;
begin
  select id into v_student_id
  from public.students
  where auth_user_id = auth.uid() and status = 'ACTIVE';

  if v_student_id is null then
    raise exception 'not an active student';
  end if;

  select class_days, class_time into v_class_days, v_class_time
  from public.batches where id = p_batch_id;

  if v_class_days is null then
    raise exception 'batch not found';
  end if;

  if v_class_time is null then
    v_class_date := v_now_local::date;
  else
    select c.d into v_class_date
    from (values (v_now_local::date - 1), (v_now_local::date), (v_now_local::date + 1)) as c(d)
    order by abs(extract(epoch from (v_now_local - (c.d + v_class_time))))
    limit 1;
  end if;

  if not (extract(dow from v_class_date)::smallint = any(v_class_days)) then
    return jsonb_build_object('ok', false, 'reason', 'not_a_class_day');
  end if;

  if v_class_time is not null then
    v_diff_seconds := abs(extract(epoch from (v_now_local - (v_class_date + v_class_time))));
    if v_diff_seconds > 1800 then
      return jsonb_build_object('ok', false, 'reason', 'outside_window');
    end if;
  end if;

  insert into public.attendance (student_id, batch_id, class_date)
  values (v_student_id, p_batch_id, v_class_date)
  on conflict (student_id, batch_id, class_date) do nothing
  returning id into v_inserted_id;

  return jsonb_build_object('ok', true, 'already_marked', v_inserted_id is null);
end;
$$;

grant execute on function public.mark_class_attendance(uuid) to authenticated;

-- Repair. A row counts as a misdated student check-in only when ALL of:
--   * its class_date is the database-clock date of joined_at (what the old
--     function wrote),
--   * joined_at is within 30 min of the batch's class_time in Toronto (a real
--     "Join Class" click, not an admin's manual mark),
--   * the Toronto class date differs and is one of the batch's class days.
drop table if exists attendance_date_fix;
create temporary table attendance_date_fix as
select a.id, a.student_id, a.batch_id, a.joined_at, a.class_date as old_date, fix.class_date as new_date
from public.attendance a
join public.batches b on b.id = a.batch_id
cross join lateral (
  select c.d as class_date,
         abs(extract(epoch from ((a.joined_at at time zone 'America/Toronto') - (c.d + b.class_time)))) as diff
  from (values ((a.joined_at at time zone 'America/Toronto')::date - 1),
               ((a.joined_at at time zone 'America/Toronto')::date),
               ((a.joined_at at time zone 'America/Toronto')::date + 1)) as c(d)
  order by 2
  limit 1
) fix
where b.class_time is not null
  and a.class_date = (a.joined_at at time zone current_setting('TimeZone'))::date
  and fix.diff <= 1800
  and fix.class_date <> a.class_date
  and extract(dow from fix.class_date)::smallint = any(b.class_days);

-- Take every misdated row out first, then put it back under its Toronto
-- date. Moving them in place could collide mid-update on a back-to-back
-- schedule (Mon's check-in stored as Tue moves to Mon while Tue's, stored as
-- Wed, moves to Tue). If the right date already has a row, the misdated one
-- was a duplicate and stays gone.
delete from public.attendance a
using attendance_date_fix f
where a.id = f.id;

insert into public.attendance (id, student_id, batch_id, class_date, joined_at)
select id, student_id, batch_id, new_date, joined_at
from attendance_date_fix
on conflict (student_id, batch_id, class_date) do nothing;

-- What changed (last statement, so it's what the SQL Editor shows). Empty
-- means nothing was misdated.
select f.old_date as saved_as, f.new_date as moved_to, s.full_name
from attendance_date_fix f
join public.students s on s.id = f.student_id
order by f.new_date desc, s.full_name;
