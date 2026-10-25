"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/siteUrl";

export type CreatePortalSessionResult = { ok: true; redirectUrl: string } | { ok: false; error: string };

/**
 * The ONLY entry point to a Stripe Billing Portal session. Deliberately
 * takes no studentId/customerId parameter from the caller at all — it
 * resolves the signed-in student from their own session
 * (getCurrentStudent, the same re-verification every /student Server
 * Action already does) and uses THEIR stripe_customer_id exclusively, so
 * there is no parameter a tampered request could substitute to open
 * another student's billing portal.
 */
export async function createOwnPortalSession(returnPath: string = "/student/subscription"): Promise<CreatePortalSessionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);

  if (!student) {
    return { ok: false, error: "not_authorized" };
  }
  if (!student.stripe_customer_id) {
    return { ok: false, error: "no_subscription" };
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: student.stripe_customer_id,
      return_url: `${getSiteUrl()}${returnPath}?from=portal`,
    });
    return { ok: true, redirectUrl: session.url };
  } catch (err) {
    console.error("[Payments] Failed to create billing portal session:", err);
    return { ok: false, error: "portal_failed" };
  }
}
