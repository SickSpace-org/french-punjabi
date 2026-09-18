-- French Punjabi — Default class_time to each batch's own displayed time
-- Run this once in the Supabase SQL Editor, after 019_attendance_time_window_and_admin_override.sql.
--
-- class_time (019) was added empty for every existing batch, so the ±30min
-- attendance check-in window couldn't be enforced anywhere until an admin
-- manually retyped a time that, in almost every case, already matches
-- time_label exactly (e.g. "8:30 AM"). This backfills class_time from
-- time_label wherever it parses as a plain "H:MM AM/PM" string, so the
-- window starts working immediately at each batch's actual class time
-- instead of needing re-entry. Only fills rows where class_time is still
-- null, so it never overwrites a value an admin already set by hand on the
-- Attendance page (see updateBatchAttendanceConfig in
-- src/app/admin/(dashboard)/courses/actions.ts).

update public.batches
set class_time = to_timestamp(time_label, 'HH12:MI AM')::time
where class_time is null
  and time_label ~* '^\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$';
