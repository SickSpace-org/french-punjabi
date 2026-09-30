-- French Punjabi — Rename the 1-on-1 offer to "One-on-one" at $30/hr.
-- Run this once in the Supabase SQL Editor, after 028_batch_change_history.sql.
-- (Same change can be made by hand in Admin → Courses → Program offers.)

update public.program_offers
set label          = 'One-on-one',
    base_price     = 30.00,
    tax_rate       = 0.13,
    display_total  = 33.90,
    duration_label = '1 hr'
where key = 'one_on_one_testing';
