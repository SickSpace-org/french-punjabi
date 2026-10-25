import "server-only";

/**
 * Strict allowlist, not derived from request headers (which are
 * attacker-controllable — a Host/Origin header can be spoofed, which would
 * otherwise let someone redirect a real Stripe Checkout session's
 * success/cancel flow to an arbitrary domain). Exactly two outcomes:
 *
 * - Actually deployed on Vercel (process.env.VERCEL === "1" — set
 *   automatically by Vercel's platform itself, true for every real
 *   deployment and nothing else; no action needed on Vercel's side):
 *   NEXT_PUBLIC_SITE_URL, verbatim — set this to the final domain at
 *   launch. Missing or empty throws immediately rather than guessing.
 * - Anything else (local `next dev`, or even a local `next build` +
 *   `next start`): always "http://localhost:3000", ignoring whatever
 *   NEXT_PUBLIC_SITE_URL happens to be set to.
 *
 * Deliberately NOT process.env.NODE_ENV — a local `next build` also sets
 * NODE_ENV=production (it's a build mode, not a "where am I running"
 * signal), which is exactly how this bug reached production in the first
 * place: a local production-mode run picked NEXT_PUBLIC_SITE_URL and
 * redirected to https://french-punjabi.vercel.app, 404ing on routes that
 * only exist locally. `VERCEL` is the actual "am I deployed" signal.
 */
export function getSiteUrl(): string {
  if (process.env.VERCEL === "1") {
    const url = process.env.NEXT_PUBLIC_SITE_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_SITE_URL is not set on Vercel — refusing to guess a redirect URL.");
    }
    return url;
  }
  return "http://localhost:3000";
}
