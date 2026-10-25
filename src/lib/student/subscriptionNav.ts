import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

/**
 * Whether the student's sidebar shows the "Subscription" link. Everyone
 * else's sidebar is unchanged.
 *
 *  (a) a Stripe-subscribed student — always;
 *  (b) a phase_completed student — always (their Subscription page is the
 *      one place they can see where they stand and re-enroll);
 *  (c) an existing (non-Stripe) student — only when
 *      existing_student_lifecycle_eligible() says so, which is the single
 *      place the rollout rules live: rollout is not 'off', they are enabled
 *      (or the rollout is 'all'), they are classified monthly, and they
 *      have a due date. Reuses that function rather than re-implementing
 *      it so the link can never show for someone the page then refuses.
 *
 * Fails closed: an RPC error hides the link rather than guessing.
 */
export async function shouldShowSubscriptionNav(
  supabase: SupabaseClient<Database>,
  student: Pick<StudentRow, "id" | "stripe_subscription_id" | "inactive_reason">
): Promise<boolean> {
  if (student.stripe_subscription_id) return true;
  if (student.inactive_reason === "phase_completed") return true;

  const { data: eligible, error } = await supabase.rpc("existing_student_lifecycle_eligible", { p_student_id: student.id });
  if (error) {
    console.error("[Student] Failed to check Subscription link eligibility:", error);
    return false;
  }
  return Boolean(eligible);
}
