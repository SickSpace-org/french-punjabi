/**
 * The public Enroll-page Stripe cutover flag — off by default (unset, or
 * anything other than the literal string "true"). Read identically on the
 * server (the real authorization boundary — submitEnrollment branches on
 * this) and the client (EnrollModal, for the button label and whether to
 * show the Terms/Referral fields the Stripe path needs). Both read the
 * same NEXT_PUBLIC_ env var baked into the same build, so they can never
 * disagree with each other — the client-side read is a display hint, not
 * a second gate.
 */
export function isStripeEnrollEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STRIPE_ENROLL_ENABLED === "true";
}
