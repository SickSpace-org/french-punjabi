-- French Punjabi — Attendance: time-window check-in + admin manual override
-- Run this once in the Supabase SQL Editor, after 018_batches_self_select.sql.
--
-- Two changes:
--
-- 1. class_time (exact time-of-day, separate from the free-text time_label
--    shown on the marketing/courses pages) lets mark_class_attendance()
--    only count a "Join Class" click as Present when it happens within 30
--    minutes either side of the batch's actual start time — previously any
--    click on a scheduled class day counted, any time of day. Batches
--    without class_time set keep the old day-only behavior (nothing breaks
--    until an admin fills it in). All batches are on Eastern time today
--    (see batches.timezone), so the window is computed in America/Toronto,
--    which also gets DST right automatically.
--
-- 2. attendance_admin_write lets an admin directly insert/delete a
--    student's attendance row for a given date — the manual "mark
--    Present"/"mark Absent" override on the admin attendance grid.
--    Present = a row exists for that date; Absent = it doesn't, so
--    "mark Absent" is a delete, not a status flag.

alter table public.batches add column if not exists class_time time;

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
  v_dow smallint := extract(dow from now())::smallint;
  v_inserted_id uuid;
  v_local_time time;
  v_diff_seconds numeric;
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

  if not (v_dow = any(v_class_days)) then
    return jsonb_build_object('ok', false, 'reason', 'not_a_class_day');
  end if;

  if v_class_time is not null then
    v_local_time := (now() at time zone 'America/Toronto')::time;
    v_diff_seconds := abs(extract(epoch from (v_local_time - v_class_time)));
    -- Circular distance, so 11:58pm vs 12:02am (a midnight-adjacent class
    -- time) still measures as 4 minutes apart, not ~24 hours.
    v_diff_seconds := least(v_diff_seconds, 86400 - v_diff_seconds);
    if v_diff_seconds > 1800 then
      return jsonb_build_object('ok', false, 'reason', 'outside_window');
    end if;
  end if;

  insert into public.attendance (student_id, batch_id, class_date)
  values (v_student_id, p_batch_id, current_date)
  on conflict (student_id, batch_id, class_date) do nothing
  returning id into v_inserted_id;

  return jsonb_build_object('ok', true, 'already_marked', v_inserted_id is null);
end;
$$;

drop policy if exists "attendance_admin_write" on public.attendance;
create policy "attendance_admin_write" on public.attendance
  for all using (public.is_admin()) with check (public.is_admin());

grant insert, update, delete on public.attendance to authenticated;
