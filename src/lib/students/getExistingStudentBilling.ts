import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PaymentMode, StudentStatus } from "@/types/database";

export type ExistingStudentBillingRow = {
  studentId: string;
  fullName: string;
  email: string;
  status: StudentStatus;
  /** From the student's most recently created enrollment. Null means
   * genuinely unclassified (see migration 050's header and the Checkpoint 3
   * proposal) — never guessed at. */
  paymentMode: PaymentMode | null;
  amountDue: number | null;
  currency: string | null;
  latestEnrollmentId: string;
  latestEnrollmentAt: string;
  nextPaymentDue: string | null;
  nextPaymentDueNeedsReview: boolean;
  /** Suggestions only — never written anywhere, purely for the admin's own
   * bulk-edit reference (see the Phase 1 proposal). */
  suggestedFromEnrollmentAnniversary: string;
  /** Per-student rollout gate — see supabase/052_existing_student_rollout.sql. */
  existingLifecycleEnabled: boolean;
};

/** The one global switch — see supabase/052_existing_student_rollout.sql
 * for the three-gate design this is part of. */
export async function getExistingStudentRollout(supabase: SupabaseClient<Database>): Promise<"off" | "per_student" | "all"> {
  const { data, error } = await supabase.from("app_config").select("existing_student_rollout").eq("id", "singleton").single();
  if (error) throw error;
  return data.existing_student_rollout;
}

/** Same "same day next month, clamped at month end, never drifts back up"
 * rule the Phase 2 settlement logic uses for real — duplicated here
 * (read-only, suggestion-only use) rather than shared, since this one
 * output is never written to the database and the real one is SQL-side.
 * See supabase/051_existing_student_manual_payment.sql for the
 * authoritative version. */
function addOneMonthClamped(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const targetMonthFirst = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const targetMonthLast = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), targetMonthLast);
  targetMonthFirst.setUTCDate(day);
  return targetMonthFirst.toISOString().slice(0, 10);
}

/**
 * Checkpoint 3, Phase 1 — every real EXISTING (non-Stripe) student, for the
 * new admin billing-setup view: due date, payment-mode classification, and
 * the "Unclassified" / "No recurring plan" / "Needs review" states the
 * proposal called for. Deliberately includes every status (not just
 * ACTIVE) so admin has full visibility — automation elsewhere stays
 * ACTIVE-only.
 */
export async function getExistingStudentBilling(supabase: SupabaseClient<Database>): Promise<ExistingStudentBillingRow[]> {
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, email, status, next_payment_due, next_payment_due_needs_review, existing_lifecycle_enabled")
    .is("stripe_subscription_id", null)
    .order("full_name", { ascending: true });
  if (studentsError) throw studentsError;
  if (students.length === 0) return [];

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("id, student_id, payment_mode, amount_due, currency, created_at")
    .in(
      "student_id",
      students.map((s) => s.id)
    )
    .order("created_at", { ascending: false });
  if (enrollmentsError) throw enrollmentsError;

  const latestByStudent = new Map<string, (typeof enrollments)[number]>();
  for (const e of enrollments) {
    if (e.student_id && !latestByStudent.has(e.student_id)) latestByStudent.set(e.student_id, e);
  }

  const result: ExistingStudentBillingRow[] = [];
  for (const s of students) {
    const latest = latestByStudent.get(s.id);
    if (!latest) continue;
    result.push({
      studentId: s.id,
      fullName: s.full_name,
      email: s.email,
      status: s.status,
      paymentMode: latest.payment_mode,
      amountDue: latest.amount_due,
      currency: latest.currency,
      latestEnrollmentId: latest.id,
      latestEnrollmentAt: latest.created_at,
      nextPaymentDue: s.next_payment_due,
      nextPaymentDueNeedsReview: s.next_payment_due_needs_review,
      suggestedFromEnrollmentAnniversary: addOneMonthClamped(latest.created_at.slice(0, 10)),
      existingLifecycleEnabled: s.existing_lifecycle_enabled,
    });
  }
  return result;
}
