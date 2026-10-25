// Pure, no DB/Next.js imports on purpose — deliberately importable from a
// plain Node test script (phaseReenrollmentCheckout.ts is "use server" and
// pulls in next/headers via createClient, which only works inside a real
// request). See scripts/checkpoint3/test-phase-reenrollment.mjs.

import { PHASE_LENGTH_DAYS, MIN_DAYS_BEFORE_PHASE_END_TO_REENROLL } from "./phaseLength";

// Subscription_status values that mean "Stripe is currently having
// trouble charging this student's CURRENT subscription" — distinct from
// 'canceled' (a subscription that's simply over, for any reason).
const PAYMENT_TROUBLE_STATUSES = new Set(["past_due", "unpaid", "incomplete", "incomplete_expired"]);

export type ReenrollBlockedReason = "suspended" | "payment_trouble" | "deactivated";

export type ReenrollEligibility = { eligible: true } | { eligible: false; reason: ReenrollBlockedReason };

export const REENROLL_BLOCKED_MESSAGES: Record<ReenrollBlockedReason, string> = {
  suspended:
    "Your account is suspended for a missed payment. Please clear that up first — contact us if you need help — before enrolling in a new phase.",
  payment_trouble:
    "We're having trouble charging your card on file. Please update your payment method before enrolling in a new phase — contact us if you need help.",
  deactivated: "Your account is currently inactive. Please contact us to sort this out before enrolling in a new phase.",
};

/**
 * Pure decision, no DB access. A SUSPENDED or currently-payment-troubled
 * student is always blocked — unambiguous either way.
 *
 * An INACTIVE student is eligible ONLY when inactive_reason is explicitly
 * 'phase_completed' — a recorded fact (set by handle_subscription_canceled
 * when a subscription's end lines up with its own recorded cap, see
 * supabase/056_inactive_reason.sql), not inferred here. Every other
 * inactive_reason ('cancelled', 'non_payment', 'admin') blocks, and so
 * does a null reason — including every student who went INACTIVE before
 * this column existed. Leaving an unknown case blocked, rather than
 * guessing it's fine, is deliberate: the cost of wrongly blocking a
 * genuine graduate is a support contact; the cost of wrongly admitting
 * someone who still owes money is a free phase.
 */
export function evaluateReenrollEligibility(student: {
  status: string;
  subscription_status: string | null;
  inactive_reason: string | null;
}): ReenrollEligibility {
  if (student.status === "SUSPENDED") return { eligible: false, reason: "suspended" };
  if (student.subscription_status && PAYMENT_TROUBLE_STATUSES.has(student.subscription_status)) {
    return { eligible: false, reason: "payment_trouble" };
  }
  if (student.status === "INACTIVE" && student.inactive_reason !== "phase_completed") {
    return { eligible: false, reason: "deactivated" };
  }
  return { eligible: true };
}

export type ReenrollTiming = { allowed: true } | { allowed: false; eligibleOn: Date };

/**
 * Option A (see phaseLength.ts's MIN_DAYS_BEFORE_PHASE_END_TO_REENROLL):
 * blocks re-enrollment until the student is within the final N days of
 * their CURRENT phase — applies to Full-paid students too, not just
 * Monthly subscribers, since a Full payer re-enrolling early would
 * otherwise drop classes they already paid for. Keyed on paidAt (when
 * their current phase's enrollment was marked PAID) rather than any
 * subscription-specific field, so it works identically whether the
 * current phase was Monthly or Full.
 *
 * currentPhasePaidAt null (no prior paid phase on record) is treated as
 * "nothing to be mid-way through" — allowed, not blocked; this function
 * is never even reached for a student with no eligible current phase,
 * since the caller already requires one to exist.
 */
export function evaluateReenrollTiming(currentPhasePaidAt: string | null, now: Date = new Date()): ReenrollTiming {
  if (!currentPhasePaidAt) return { allowed: true };

  const paidAtMs = new Date(currentPhasePaidAt).getTime();
  const eligibleOnMs = paidAtMs + (PHASE_LENGTH_DAYS - MIN_DAYS_BEFORE_PHASE_END_TO_REENROLL) * 24 * 60 * 60 * 1000;

  if (now.getTime() >= eligibleOnMs) return { allowed: true };
  return { allowed: false, eligibleOn: new Date(eligibleOnMs) };
}
