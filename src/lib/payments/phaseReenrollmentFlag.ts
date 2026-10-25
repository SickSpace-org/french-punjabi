/**
 * Phase re-enrollment's own flag — off by default (unset, or anything
 * other than the literal string "true"). Read identically on the server
 * (the real authorization boundary — getReenrollmentOptions /
 * createPhaseReenrollmentCheckout both check this first) and the client
 * (PhaseReenrollment, to decide whether to even call the Server Action).
 * Mirrors src/lib/enrollment/stripeEnrollFlag.ts's own pattern — same
 * reasoning: both reads come from the same NEXT_PUBLIC_ env var baked into
 * the same build, so they can never disagree.
 */
export function isPhaseReenrollmentEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHASE_REENROLLMENT_ENABLED === "true";
}
