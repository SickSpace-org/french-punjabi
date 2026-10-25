import type { SupabaseClient } from "@supabase/supabase-js";
import { DUE_NOTICE_WINDOW_DAYS, formatDueDateLabel, isInDueNoticeWindow, utcDateString } from "./existingStudentRules";

/**
 * The "your monthly payment is due soon" notice for existing (non-Stripe,
 * monthly) students — a neutral heads-up with the due date and a way to
 * pay, nothing about consequences. Called from the daily cron.
 *
 * Obeys every gate, and re-checks them here rather than trusting the query:
 *   - app_config.existing_student_rollout must not be 'off' (checked first,
 *     so with the default 'off' this is a single cheap read and nothing else)
 *   - existing_student_lifecycle_eligible() — the one place the three
 *     rollout gates live, which also excludes Full and unclassified
 *     students, anyone without a due date, anyone not enabled in
 *     'per_student' mode, and anyone already on Stripe
 *   - ACTIVE students only
 *
 * Sent at most once per billing cycle: the in-portal notification row IS
 * the record. payment_notifications.kind is a CHECK-constrained list that
 * can't be widened without a migration, so this reuses 'renewal_upcoming'
 * (the same neutral "payment coming up" meaning the Stripe students get);
 * a row for this student created since the window opened (due date - 8
 * days) means this cycle's notice already went out.
 *
 * The notification is written first and is the primary channel; the email
 * is best-effort on top, same as every other notification here. Takes
 * `deliver` as a parameter so the test script can capture sends instead of
 * emailing anyone.
 */
export type DueNoticeDelivery = (notice: {
  to: string;
  fullName: string;
  amount: number;
  currency: string;
  dueDateLabel: string;
}) => Promise<unknown>;

export type DueNoticeResult = { notified: number; skipped: Record<string, number> };

export async function sendExistingStudentDueNotices(
  supabase: SupabaseClient,
  deliver: DueNoticeDelivery,
  now: Date = new Date()
): Promise<DueNoticeResult> {
  const result: DueNoticeResult = { notified: 0, skipped: {} };
  const skip = (reason: string) => {
    result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
  };

  const { data: config } = await supabase.from("app_config").select("existing_student_rollout").eq("id", "singleton").maybeSingle();
  if (!config || config.existing_student_rollout === "off") return result;

  const { data: candidates, error } = await supabase
    .from("students")
    .select("id, full_name, email, next_payment_due")
    .is("stripe_subscription_id", null)
    .eq("status", "ACTIVE")
    .not("next_payment_due", "is", null)
    .gte("next_payment_due", utcDateString(now))
    .lte("next_payment_due", utcDateString(now, DUE_NOTICE_WINDOW_DAYS));
  if (error) {
    console.error("[ExistingStudentDueNotice] Failed to load candidates:", error);
    return result;
  }

  for (const c of candidates ?? []) {
    if (!isInDueNoticeWindow(c.next_payment_due, now)) {
      skip("outside_window");
      continue;
    }

    const { data: eligible } = await supabase.rpc("existing_student_lifecycle_eligible", { p_student_id: c.id });
    if (!eligible) {
      skip("not_eligible");
      continue;
    }

    const windowOpened = `${utcDateString(new Date(`${c.next_payment_due}T00:00:00Z`), -(DUE_NOTICE_WINDOW_DAYS + 1))}T00:00:00Z`;
    const { data: alreadySent } = await supabase
      .from("payment_notifications")
      .select("id")
      .eq("student_id", c.id)
      .eq("kind", "renewal_upcoming")
      .gte("created_at", windowOpened)
      .limit(1);
    if (alreadySent && alreadySent.length > 0) {
      skip("already_sent_this_cycle");
      continue;
    }

    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("amount_due, currency")
      .eq("student_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!enrollment?.amount_due || enrollment.amount_due <= 0) {
      skip("no_amount");
      continue;
    }

    const dueDateLabel = formatDueDateLabel(c.next_payment_due);
    const { error: insertError } = await supabase.from("payment_notifications").insert({
      student_id: c.id,
      kind: "renewal_upcoming",
      message: `Your monthly payment of ${enrollment.currency} $${enrollment.amount_due.toFixed(2)} is due on ${dueDateLabel}. You can pay online from Subscription.`,
    });
    if (insertError) {
      console.error("[ExistingStudentDueNotice] Failed to insert notification:", c.id, insertError);
      skip("insert_failed");
      continue;
    }

    await deliver({
      to: c.email,
      fullName: c.full_name,
      amount: enrollment.amount_due,
      currency: enrollment.currency,
      dueDateLabel,
    }).catch(() => undefined);
    result.notified += 1;
  }

  return result;
}
