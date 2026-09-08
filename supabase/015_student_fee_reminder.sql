-- French Punjabi — Fee reminder + editable next-payment date on students
-- Run this once in the Supabase SQL Editor, after 014_student_status_edit_and_reenroll.sql.
--
-- Adds a plain, admin-editable date the admin sets/adjusts for a student's
-- next (recurring, e.g. monthly-plan) payment. Not tied to any enrollment's
-- one-time Interac confirmation flow (see confirm_enrollment_payment /
-- sendPaymentReminder in enrollments/actions.ts, which is only about the
-- initial signup payment) — this is a separate, ongoing reminder an admin
-- can send/re-send from the Students tab at any time, for any ACTIVE
-- student, regardless of payment_status on their enrollment(s).

alter table public.students add column if not exists next_payment_due date;
