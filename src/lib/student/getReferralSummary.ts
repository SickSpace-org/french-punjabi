import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ReferralSummary = {
  referralCode: string | null;
  friendsJoined: number;
  creditedCount: number;
};

/** "Friends joined" counts anyone who referred-signed-up, even if their
 * first payment hasn't succeeded yet (status 'pending') — the student
 * should see their referral worked, even before the $25 reward itself
 * is earned. "Credited" is strictly status='applied' (an actual $25 off
 * one invoice), matching the real reward rule exactly. */
export async function getReferralSummary(
  supabase: SupabaseClient<Database>,
  studentId: string,
  referralCode: string | null
): Promise<ReferralSummary> {
  const { data } = await supabase.from("student_referrals").select("status").eq("referrer_student_id", studentId);

  return {
    referralCode,
    friendsJoined: data?.length ?? 0,
    creditedCount: data?.filter((r) => r.status === "applied").length ?? 0,
  };
}
