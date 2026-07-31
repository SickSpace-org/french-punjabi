-- French Punjabi — migrate the current hardcoded course data into Supabase.
-- Run this once, after 001_schema.sql. It's a no-op if `phases` already has
-- rows, so it's safe to run more than once.
--
-- NOTE: `program_offers` → 'complete_program' has base_price 1200.00 and
-- tax_rate 0.13, but the site's current displayed total is 1354.87
-- (1200 * 1.13 = 1356.00 — a $1.13 mismatch that predates this migration).
-- That mismatch is preserved here exactly as currently shown on the site,
-- not silently corrected. Fix it later from Admin → Courses → Pricing if
-- it was unintentional.

do $$
declare
  v_phase1_id uuid;
  v_phase2_id uuid;
  v_phase3_id uuid;
  v_p1_l1_id uuid;
  v_p1_l2_id uuid;
  v_p1_l3_id uuid;
  v_p2_l1_id uuid;
  v_p2_l2_id uuid;
begin
  if exists (select 1 from public.phases) then
    raise notice 'Seed skipped: public.phases already has rows.';
    return;
  end if;

  -- =======================================================
  -- Phase 1 — Foundation
  -- =======================================================
  insert into public.phases (slug, phase_number, code, title, months_label, badge, description, display_order)
  values (
    'phase-1', 1, 'Phase 01', 'Foundation', 'Months 1–3', '3 Levels',
    'Build the foundation of French through progressive Level 1, Level 2 and Level 3 classes.',
    1
  )
  returning id into v_phase1_id;

  insert into public.levels (phase_id, slug, name, display_order)
  values (v_phase1_id, 'phase-1-level-1', 'Level 1', 1)
  returning id into v_p1_l1_id;

  insert into public.levels (phase_id, slug, name, display_order)
  values (v_phase1_id, 'phase-1-level-2', 'Level 2', 2)
  returning id into v_p1_l2_id;

  insert into public.levels (phase_id, slug, name, display_order)
  values (v_phase1_id, 'phase-1-level-3', 'Level 3', 3)
  returning id into v_p1_l3_id;

  insert into public.batches (level_id, time_label, timezone, display_order) values
    (v_p1_l1_id, '8:00 PM', 'EST', 1),
    (v_p1_l1_id, '10:00 PM', 'EST', 2),
    (v_p1_l1_id, '8:30 AM', 'EST', 3);

  insert into public.batches (level_id, time_label, timezone, note, display_order) values
    (v_p1_l2_id, '9:00 PM', 'EST', null, 1),
    (v_p1_l2_id, '11:00 AM', 'EST', 'Morning Batch', 2);

  insert into public.batches (level_id, time_label, timezone, note, display_order) values
    (v_p1_l3_id, '10:00 PM', 'EST', null, 1),
    (v_p1_l3_id, '11:00 PM', 'EST', null, 2),
    (v_p1_l3_id, '10:00 AM', 'EST', 'Morning Batch', 3);

  insert into public.pricing (phase_id, payment_mode, base_price, tax_rate, display_total, duration_label) values
    (v_phase1_id, 'full', 549.00, 0.13, 620.37, '3 Months'),
    (v_phase1_id, 'monthly', 199.00, 0.13, 224.87, null);

  -- =======================================================
  -- Phase 2 — TEF / TCF Preparation
  -- =======================================================
  insert into public.phases (slug, phase_number, code, title, months_label, badge, description, display_order)
  values (
    'phase-2', 2, 'Phase 02', 'TEF / TCF Preparation', 'Months 4–5', '2 Levels',
    'Move from foundational French into practical communication and focused TEF/TCF preparation.',
    2
  )
  returning id into v_phase2_id;

  insert into public.levels (phase_id, slug, name, display_order)
  values (v_phase2_id, 'phase-2-level-1', 'Level 1', 1)
  returning id into v_p2_l1_id;

  insert into public.levels (phase_id, slug, name, display_order)
  values (v_phase2_id, 'phase-2-level-2', 'Level 2', 2)
  returning id into v_p2_l2_id;

  insert into public.batches (level_id, time_label, timezone, display_order) values
    (v_p2_l1_id, '11:00 PM', 'EST', 1);

  insert into public.batches (level_id, time_label, timezone, display_order) values
    (v_p2_l2_id, '8:00 PM', 'EST', 1);

  insert into public.pricing (phase_id, payment_mode, base_price, tax_rate, display_total, duration_label) values
    (v_phase2_id, 'full', 349.00, 0.13, 394.37, '2 Months'),
    (v_phase2_id, 'monthly', 199.00, 0.13, 224.87, null);

  -- =======================================================
  -- Phase 3 — Exam Mastery (batch-style, no Levels)
  -- =======================================================
  insert into public.phases (slug, phase_number, code, title, months_label, badge, description, display_order)
  values (
    'phase-3', 3, 'Phase 03', 'Exam Mastery', 'Months 6–7', null,
    'Advanced exam-focused batches, mock practice and final preparation.',
    3
  )
  returning id into v_phase3_id;

  insert into public.batches (phase_id, slug, name, teacher_name, time_label, timezone, display_order) values
    (v_phase3_id, 'phase-3-batch-1', 'Hitesh Batch', 'Hitesh', '10:00 PM', 'EST', 1),
    (v_phase3_id, 'phase-3-batch-2', 'Hitesh Batch', 'Hitesh', '9:00 PM', 'EST', 2),
    (v_phase3_id, 'phase-3-native', 'Native Batch', null, '9:00 PM', 'EST', 3),
    (v_phase3_id, 'phase-3-tcf', 'TCF Batch', null, '10:00 PM', 'EST', 4),
    (v_phase3_id, 'phase-3-tcf-native', 'TCF Native', null, '8:30 AM', 'EST', 6);

  insert into public.batches (phase_id, slug, name, time_label, timezone, is_tbd, display_order) values
    (v_phase3_id, 'phase-3-tef-morning', 'TEF Morning Batch', 'Morning Timing', '', true, 5);

  insert into public.pricing (phase_id, payment_mode, base_price, tax_rate, display_total, duration_label) values
    (v_phase3_id, 'full', 349.00, 0.13, 394.37, '2 Months'),
    (v_phase3_id, 'monthly', 199.00, 0.13, 224.87, null);

  -- =======================================================
  -- Program-wide offers
  -- =======================================================
  insert into public.program_offers (key, label, base_price, tax_rate, display_total, duration_label) values
    ('complete_program', 'Complete 7-Month Program', 1200.00, 0.13, 1354.87, '7 Months'),
    ('redo_month', '$199 + Tax / Month', 199.00, 0.13, 224.87, null);

end $$;
