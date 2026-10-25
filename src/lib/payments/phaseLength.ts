// THE RULE THIS FILE ENCODES (pending Hitesh's confirmation): a Monthly
// subscription — for the original signup AND for re-enrolling into a new
// phase — bills for 90 days and then stops automatically. It does not
// keep billing indefinitely until the student manually cancels. This is
// a single, named source of truth specifically so the rule is easy to
// find, read, and change in one place once confirmed.
//
// Used by:
//   - subscriptionCheckout.ts (the original Phase 1 public signup)
//   - phaseReenrollmentCheckout.ts (an existing student buying a new phase)
// Both apply it the same way: computed as a cancel_at timestamp at
// checkout time, passed through Checkout Session metadata (Stripe's
// subscription_data has no cancel_at field at creation time), and applied
// by the webhook (handleCheckoutCompleted in
// src/app/api/stripe/webhook/route.ts) via a follow-up
// subscriptions.update() once the subscription actually exists — see that
// file's own comments for the full mechanism, including how a clean
// cap-ending is told apart from any other subscription cancellation
// (supabase/056_inactive_reason.sql).
export const PHASE_LENGTH_DAYS = 90;
export const PHASE_LENGTH_SECONDS = PHASE_LENGTH_DAYS * 24 * 60 * 60;

// THE RULE OPTION A ENCODES (pending Hitesh's confirmation of N, and
// whether he'd rather have option B — reserve the next seat now, switch
// at period end — instead): re-enrollment into a new phase is blocked
// until the student is within the final N days of their CURRENT phase.
// Applies to Full-paid students too, not just Monthly subscribers — a
// Full payer re-enrolling early would otherwise drop classes they already
// paid for, same as a Monthly subscriber forfeiting unused paid days.
// See src/lib/payments/reenrollEligibility.ts's evaluateReenrollTiming.
export const MIN_DAYS_BEFORE_PHASE_END_TO_REENROLL = 14;
