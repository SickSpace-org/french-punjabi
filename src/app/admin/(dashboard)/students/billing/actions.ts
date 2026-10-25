"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { announceExistingStudentPaymentIfEligible } from "@/lib/students/announceExistingStudentPayment";
import type { PaymentMode } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checkpoint 3, Phase 1 — admin sets an existing (non-Stripe) student's
 * recurring due date directly. Goes through admin_set_existing_student_due_date
 * (migration 054), not a plain table update: is_admin()-gated, refuses a
 * non-'monthly' student, and logs who changed it and the old -> new value
 * to payment_events.
 */
export async function updateNextPaymentDue(studentId: string, dateOnly: string | null): Promise<ActionResult> {
  if (dateOnly !== null && !DATE_RE.test(dateOnly)) {
    return { ok: false, error: "Please enter a valid date (YYYY-MM-DD)." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_existing_student_due_date", {
    p_student_id: studentId,
    p_next_payment_due: dateOnly,
  });

  if (error) return { ok: false, error: "Failed to update due date." };
  if (!data?.ok) {
    return {
      ok: false,
      error: data?.reason === "not_monthly" ? "This student needs a monthly classification first." : "Failed to update due date.",
    };
  }
  revalidatePath("/admin/students/billing");
  return { ok: true };
}

/**
 * Classifies (or re-classifies) a student's recurring payment mode by
 * editing their latest enrollment's payment_mode directly — that column,
 * not a new one on students, is the real source of truth (see
 * getExistingStudentBilling.ts). 'subscription' is deliberately not a
 * valid target here — that value means Stripe-managed, set only by the
 * real Stripe activation path, never by this admin classification tool.
 */
export async function updatePaymentMode(enrollmentId: string, mode: Exclude<PaymentMode, "subscription">): Promise<ActionResult> {
  if (mode !== "full" && mode !== "monthly") {
    return { ok: false, error: "Invalid payment mode." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").update({ payment_mode: mode }).eq("id", enrollmentId);

  if (error) return { ok: false, error: "Failed to update payment mode." };
  revalidatePath("/admin/students/billing");
  return { ok: true };
}

export type BulkBillingRow = { studentId: string; nextPaymentDue: string };

export type BulkImportResult = { ok: true; updated: number; skipped: { studentId: string; reason: string }[] } | { ok: false; error: string };

/**
 * CSV import — due dates only (payment-mode classification is a per-row
 * action in the table, never bulk-importable, so a CSV can't be used to
 * sneak a Full/Unclassified student into looking monthly). The caller
 * (BillingTable.tsx) shows the admin a preview and gets explicit
 * confirmation before this is ever called, and has already filtered out
 * rows for Full/Unclassified students and invalid dates client-side —
 * this still re-checks both server-side via the same audited RPC every
 * other due-date write in this file uses
 * (admin_set_existing_student_due_date, migration 054), which is the
 * real "skips Full and Unclassified, rejects invalid dates" boundary,
 * not the preview UI. Each row applies independently and is logged with
 * who made it; one bad row doesn't block the rest.
 */
export async function bulkImportBilling(rows: BulkBillingRow[]): Promise<BulkImportResult> {
  const supabase = await createClient();
  const skipped: { studentId: string; reason: string }[] = [];
  let updated = 0;

  for (const row of rows) {
    if (!DATE_RE.test(row.nextPaymentDue)) {
      skipped.push({ studentId: row.studentId, reason: `invalid date "${row.nextPaymentDue}"` });
      continue;
    }
    const { data, error } = await supabase.rpc("admin_set_existing_student_due_date", {
      p_student_id: row.studentId,
      p_next_payment_due: row.nextPaymentDue,
    });
    if (error || !data?.ok) {
      skipped.push({ studentId: row.studentId, reason: data?.reason === "not_monthly" ? "not classified monthly" : "update failed" });
      continue;
    }
    updated += 1;
  }

  revalidatePath("/admin/students/billing");
  return { ok: true, updated, skipped };
}

export type SettleResult = {
  ok: boolean;
  reason?: string;
  needsReview?: boolean;
  reactivated?: boolean;
  reactivationBlocked?: boolean;
};

/**
 * Admin manually records a payment for an existing (non-Stripe) student —
 * clears overdue, moves the due date forward one billing cycle
 * (month-end-safe — see supabase/051_existing_student_manual_payment.sql),
 * and restores access: SUSPENDED -> ACTIVE directly, INACTIVE -> ACTIVE
 * only if their batch still has room (seat-aware).
 */
export async function recordManualPayment(studentId: string, amount: number, currency: string): Promise<SettleResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Please enter a valid amount." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_manual_payment_for_existing_student", {
    p_student_id: studentId,
    p_amount: amount,
    p_currency: currency,
  });

  if (error) return { ok: false, reason: "Failed to record payment." };
  if (!data?.ok) {
    return {
      ok: false,
      reason:
        data?.reason === "stripe_managed_student"
          ? "This student is Stripe-managed — use the Payments page, not this one."
          : data?.reason === "invalid_amount"
            ? "Please enter a valid amount."
            : data?.reason === "not_monthly"
              ? "This student needs a monthly classification first."
              : "Student not found.",
    };
  }

  revalidatePath("/admin/students/billing");
  return { ok: true, needsReview: data.needs_review, reactivated: data.reactivated, reactivationBlocked: data.reactivation_blocked };
}

/** Per-student rollout gate (Phase 3) — only meaningful for a classified
 * 'monthly' student with a verified due date; the RPC itself doesn't
 * enforce that (it's just a flag), so this Server Action does, matching
 * the "excluded from everything until classified" rule. */
export async function updateStudentLifecycleEnabled(studentId: string, enabled: boolean, paymentMode: string | null, hasDueDate: boolean): Promise<ActionResult> {
  if (enabled && (paymentMode !== "monthly" || !hasDueDate)) {
    return { ok: false, error: "Needs a monthly classification and a due date before it can be enabled." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ existing_lifecycle_enabled: enabled }).eq("id", studentId);
  if (error) return { ok: false, error: "Failed to update." };
  if (enabled) await announceExistingStudentPaymentIfEligible(supabase, studentId);
  revalidatePath("/admin/students/billing");
  return { ok: true };
}

/** The global switch (Phase 3) — 'off' | 'per_student' | 'all'. Flipping
 * to 'all' can newly make many students eligible at once, so this
 * announces every one of them that hasn't been announced to yet. */
export async function updateExistingStudentRollout(rollout: "off" | "per_student" | "all"): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("app_config").update({ existing_student_rollout: rollout }).eq("id", "singleton");
  if (error) return { ok: false, error: "Failed to update rollout setting." };

  if (rollout === "all") {
    const { data: candidates } = await supabase
      .from("students")
      .select("id")
      .is("stripe_subscription_id", null)
      .is("existing_lifecycle_announced_at", null)
      .not("next_payment_due", "is", null);
    for (const c of candidates ?? []) {
      await announceExistingStudentPaymentIfEligible(supabase, c.id);
    }
  }

  revalidatePath("/admin/students/billing");
  return { ok: true };
}
