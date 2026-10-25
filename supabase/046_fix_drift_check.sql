-- French Punjabi — fixes a real design bug in check_filled_slots_drift()
-- found by actually running it against live data (migration 045).
--
-- PLAIN LANGUAGE: pure correction to a function this project added an
-- hour earlier, nothing else. Touches no column, no existing RLS policy,
-- no pre-existing table. Safe to re-run (create or replace).
--
-- What was wrong:
--   1. filled_slots is ONE shared counter for both the legacy
--      admin-manual Interac flow and the new Stripe flow. For a batch
--      that has ever had a legacy ('full'/'monthly') enrollment, there is
--      no way to know how much of filled_slots is the old manual count vs
--      Stripe's — comparing the WHOLE counter to "active Stripe students"
--      is meaningless there and flagged every real batch in the system
--      as 100% drifted. Fixed by only checking batches whose enrollments
--      are ALL 'subscription' mode (a real mix is excluded entirely, not
--      guessed at).
--   2. A SUSPENDED student still holds their seat by design (that's what
--      "the seat stays held" means) — the check only counted ACTIVE,
--      so every real SUSPENDED seed student looked like drift. Fixed to
--      count ACTIVE and SUSPENDED both.

-- Note: kept the output column named actual_active_count (not renamed to
-- something like actual_seat_holding_count) specifically because
-- PostgreSQL's CREATE OR REPLACE cannot change a RETURNS TABLE column
-- name without a DROP FUNCTION first — not worth the extra statement
-- just for a label. It now also counts SUSPENDED students (see below),
-- so the name is a little imprecise; this comment is the correction.
create or replace function public.check_filled_slots_drift()
returns table (batch_id uuid, recorded_filled_slots int, actual_active_count bigint, drift int)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id as batch_id,
    b.filled_slots as recorded_filled_slots,
    count(distinct s.id) as actual_active_count,
    b.filled_slots - count(distinct s.id)::int as drift
  from public.batches b
  join public.enrollments e on e.batch_id = b.id
  left join public.students s
    on s.id = e.student_id
    and s.status in ('ACTIVE', 'SUSPENDED')
    and s.stripe_subscription_id is not null
    and e.payment_mode = 'subscription'
  where not exists (
    select 1 from public.enrollments e2
    where e2.batch_id = b.id and e2.payment_mode in ('full', 'monthly')
  )
  group by b.id, b.filled_slots
  having b.filled_slots <> count(distinct s.id)
  order by abs(b.filled_slots - count(distinct s.id)::int) desc;
$$;

grant execute on function public.check_filled_slots_drift() to authenticated, service_role;
