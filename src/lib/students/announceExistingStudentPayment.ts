import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendExistingStudentPaymentAvailableEmail } from "@/lib/email/send";

/**
 * Checkpoint 3, item 7 — the "you can now pay online" announcement. Obeys
 * the exact same three gates as everything else in this feature
 * (existing_student_lifecycle_eligible, migration 052) and sends at most
 * once per student ever (existing_lifecycle_announced_at). The in-portal
 * notification is the PRIMARY channel — the email alongside it is
 * best-effort on top, same as every other notification in this app, and
 * is the one piece of this whole feature that can't be verified
 * end-to-end right now (Resend sandbox mode).
 *
 * Called from the two Server Actions that can newly make a student
 * eligible: enabling them individually, and flipping the global switch to
 * 'all' (which can make many students eligible at once — see its caller).
 */
export async function announceExistingStudentPaymentIfEligible(supabase: SupabaseClient<Database>, studentId: string): Promise<void> {
  const { data: student } = await supabase
    .from("students")
    .select("id, full_name, email, existing_lifecycle_announced_at")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.existing_lifecycle_announced_at) return;

  const { data: eligible } = await supabase.rpc("existing_student_lifecycle_eligible", { p_student_id: studentId });
  if (!eligible) return;

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("amount_due, currency")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!enrollment?.amount_due) return;

  const { error } = await supabase
    .from("payment_notifications")
    .insert({
      student_id: studentId,
      kind: "existing_student_payment_available",
      message: `You can now pay your monthly ${enrollment.currency} $${enrollment.amount_due.toFixed(2)} online — find it under Subscription.`,
    });
  if (error) {
    console.error("[AnnounceExistingStudentPayment] Failed to insert notification:", error);
    return;
  }

  await supabase.from("students").update({ existing_lifecycle_announced_at: new Date().toISOString() }).eq("id", studentId);

  await sendExistingStudentPaymentAvailableEmail(student.email, {
    fullName: student.full_name,
    amount: enrollment.amount_due,
    currency: enrollment.currency,
  }).catch(() => undefined);
}
