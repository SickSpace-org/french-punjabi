-- French Punjabi — Speaking quiz: distinguish free-topic vs read-aloud attempts.
-- Run this once in the Supabase SQL Editor, after 025_quiz_attempts.sql.
--
-- Adds a `mode` column so quiz history can tell a free-topic speaking
-- attempt (prompt = an English instruction) apart from a read-aloud
-- attempt (prompt = the exact French text the student was asked to read).
-- Existing rows (all created before this feature existed) default to
-- 'free', which matches how every attempt was graded before this column
-- existed.

alter table public.quiz_attempts
  add column if not exists mode text not null default 'free'
    check (mode in ('free', 'read-aloud'));
