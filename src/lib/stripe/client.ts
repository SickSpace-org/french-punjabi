import "server-only";
import Stripe from "stripe";

/**
 * Pinned explicitly rather than left to whatever the installed `stripe`
 * package happens to default to (currently 2026-09-30.endive, confirmed
 * against the installed SDK) — an npm update bumping the package could
 * otherwise silently change which API shape every request/webhook uses.
 * Bumping this is a deliberate, tested decision, never a side effect of
 * `npm update`.
 */
const STRIPE_API_VERSION = "2026-09-30.endive";

/**
 * Single Stripe SDK instance for the whole app. `STRIPE_SECRET_KEY` must be
 * a TEST MODE key (sk_test_...) until this project explicitly moves to
 * live keys — see the Stage 1 build notes for the exact env vars to add.
 */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}
