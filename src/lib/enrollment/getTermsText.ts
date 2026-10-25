"use server";

import { createPublicClient } from "@/lib/supabase/server";

/**
 * Small, dedicated Server Action so EnrollModal (a deeply client-side
 * component, reached through PhaseEnroll/OfferEnrollButton) can fetch the
 * current terms text itself when the Stripe cutover flag is on, instead
 * of threading it down as a prop through every parent — keeps this
 * feature's footprint to EnrollModal.tsx alone rather than touching the
 * whole Courses-page component tree. Mirrors exactly what
 * test-stripe-subscription/page.tsx already does server-side.
 */
export async function getTermsText(): Promise<string> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("terms_versions")
    .select("body_text")
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.body_text ?? "Terms unavailable.";
}
