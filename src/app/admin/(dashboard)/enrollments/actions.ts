"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendPaymentConfirmedEmail } from "@/lib/email/send";
import { inviteStudentAndLink } from "@/lib/students/inviteAndLink";
import type { EnrollmentRow, EnrollmentStatus } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Relies on Supabase RLS (public.is_admin()) as the real authorization
 * boundary, same as src/app/admin/(dashboard)/courses/actions.ts — the
 * server client carries the caller's session, so a non-admin session's
 * write is rejected by the database regardless of this file.
 */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").update({ status }).eq("id", enrollmentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/enrollments");
  return { ok: true };
}

export type ConfirmPaymentResult =
  | { ok: true; alreadyConfirmed: boolean; paidAt: string }
  | { ok: false; error: string };

/**
 * The ONLY way an enrollment's payment_status can become PAID. Calls
 * public.confirm_enrollment_payment(), a security-definer Postgres
 * function that re-checks is_admin() itself (see
 * supabase/005_payments_students.sql) — so this is enforced by the
 * database, not just by this button being hidden from non-admins.
 *
 * The function is idempotent: a double-click or page refresh re-runs this
 * action, but the DB only performs the PENDING->PAID transition and the
 * students insert once (row-locked), and reports `just_confirmed: false`
 * on every call after the first — which is why the "Enrollment Confirmed"
 * email is only ever sent once, right here.
 */
export async function confirmEnrollmentPayment(enrollmentId: string): Promise<ConfirmPaymentResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_enrollment_payment", {
    p_enrollment_id: enrollmentId,
  });

  if (error || !data) {
    return { ok: false, error: error?.message || "Unable to confirm payment. Please try again." };
  }

  const enrollment = data.enrollment as EnrollmentRow;

  if (data.just_confirmed) {
    await sendPaymentConfirmedEmail(enrollment.email, {
      fullName: enrollment.full_name,
      phaseName: enrollment.phase_name,
      levelName: enrollment.level_name,
      batchTiming: enrollment.batch_timing,
      enrollmentRef: enrollment.enrollment_ref,
      amountDue: Number(enrollment.amount_due),
      currency: enrollment.currency,
    });
  }

  // Best-effort — never let a hiccup here undo the payment confirmation
  // above. Only invite once per student (2nd/3rd course for the same
  // person reuses the same portal login, never a second account).
  if (data.student_id) {
    const { data: studentRow } = await supabase
      .from("students")
      .select("auth_user_id")
      .eq("id", data.student_id)
      .maybeSingle();

    if (studentRow && !studentRow.auth_user_id) {
      const inviteResult = await inviteStudentAndLink(
        data.student_id,
        enrollment.email,
        enrollment.full_name
      );
      if (!inviteResult.ok) {
        console.error("[Enrollment] Failed to invite/link student portal account:", inviteResult.reason);
      }
    }
  }

  revalidatePath("/admin/enrollments");
  revalidatePath("/admin/students");

  return {
    ok: true,
    alreadyConfirmed: !data.just_confirmed,
    paidAt: enrollment.paid_at ?? new Date().toISOString(),
  };
}
