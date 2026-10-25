-- French Punjabi — Checkpoint 3, Phase 1: existing-student due-date tracking.
--
-- PLAIN LANGUAGE: pure addition. One new column on students, default false
-- for every existing row. No existing column, constraint, RLS policy, or
-- function is touched. Cannot affect any current student's access, status,
-- or billing — nothing reads this column yet, and nothing in this file
-- writes to it either. Safe to re-run (add column if not exists).
--
-- next_payment_due_needs_review: set by the manual-payment / autopay
-- settlement logic (Phase 2, a later migration) when advancing a
-- student's due date by one billing cycle still lands in the past (e.g.
-- someone several months behind) — rather than guess how many cycles to
-- skip, that logic flags the student here instead of silently picking a
-- date. Admin clears it by setting next_payment_due directly. Added now
-- (Phase 1) only so the due-date admin UI has a column to display it in
-- from the start; nothing sets it to true yet.

alter table public.students add column if not exists next_payment_due_needs_review boolean not null default false;
