"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";

export async function getOrCreateOwnReferralCode(): Promise<string | null> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null;

  const { data, error } = await supabase.rpc("generate_referral_code", { p_student_id: student.id });
  if (error) {
    console.error("[Referral] Failed to generate code:", error);
    return null;
  }
  return data;
}
