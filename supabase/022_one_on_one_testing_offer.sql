-- French Punjabi — New program-wide offer: 1-on-1 Testing session
-- Run this once in the Supabase SQL Editor, after 021_lesson_videos.sql.
--
-- program_offers (001_schema.sql) previously only allowed 'complete_program'
-- and 'redo_month' — widen the check constraint to also allow this new key,
-- then add the row. $20 + 13% tax for a 30-minute session, same pattern as
-- the other two program-wide fees (not tied to a phase/batch).

alter table public.program_offers drop constraint if exists program_offers_key_check;
alter table public.program_offers add constraint program_offers_key_check
  check (key in ('complete_program', 'redo_month', 'one_on_one_testing'));

insert into public.program_offers (key, label, base_price, tax_rate, display_total, duration_label)
values ('one_on_one_testing', '1-on-1 Testing', 20.00, 0.13, 22.60, '30 min')
on conflict (key) do nothing;
