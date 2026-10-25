const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids ambiguous refs

/** e.g. "FP-2026-A7K4P2" — shown to the student and used by the admin to
 * match an incoming Interac e-Transfer to this enrollment. Shared by the
 * legacy Interac flow (actions.ts) and the Stripe subscription checkout
 * path (src/lib/payments/subscriptionCheckout.ts) — same enrollments
 * table, same reference format for both. Plain sync utility, deliberately
 * NOT exported from a "use server" file (Next.js requires every export of
 * one of those to be an async Server Action). */
export function generateEnrollmentRef(): string {
  const year = new Date().getFullYear();
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  }
  return `FP-${year}-${code}`;
}
