import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import {
  sendPaymentOverdueReminderEmail,
  sendSubscriptionAccessSuspendedEmail,
  sendSubscriptionAccessRevokedEmail,
  sendExistingStudentDigest,
  sendExistingStudentDueSoonEmail,
} from "@/lib/email/send";
import { getSiteUrl } from "@/lib/siteUrl";
import { enforcementAllowed } from "@/lib/students/existingStudentRules";
import { sendExistingStudentDueNotices } from "@/lib/students/existingStudentDueNotice";

async function insertPaymentNotification(
  supabase: ReturnType<typeof createAdminClient>,
  studentId: string,
  kind: "access_suspended" | "access_revoked",
  message: string
) {
  const { error } = await supabase.from("payment_notifications").insert({ student_id: studentId, kind, message });
  if (error) console.error("[CronPaymentLifecycle] Failed to insert payment_notifications row:", error);
}

type SweepResult = {
  suspended: string[];
  inactivated: { student_id: string; stripe_subscription_id: string | null; batch_id: string | null }[];
  reminders: string[];
  expired_holds_released: number;
};

/**
 * The daily job (B2). Secured so only our own scheduler can call it —
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
 * once a `crons` entry in vercel.json points at this route and the
 * CRON_SECRET env var is set; anything else is rejected with 401.
 *
 * Does the DB-side state transitions via run_payment_lifecycle_sweep()
 * (one locked pass — see supabase/044_payment_failure_lifecycle.sql), then
 * the two things only this TS layer can do: actually cancel the Stripe
 * subscription for every student the sweep just moved to INACTIVE (the
 * SQL function can't call Stripe), and send the day-1/2/3 reminder emails
 * (best-effort, never blocks the sweep itself).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("run_payment_lifecycle_sweep");

  if (error) {
    console.error("[CronPaymentLifecycle] run_payment_lifecycle_sweep failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as SweepResult;
  const stripe = getStripeClient();

  // A8 — day 4: ACTIVE -> SUSPENDED. Notify before the Stripe cancel loop
  // below so a student never gets the "revoked" email without first having
  // gotten the "suspended" one on an earlier run (the two lists are always
  // disjoint — a student in `inactivated` today was SUSPENDED on some
  // earlier day's run, not this one).
  for (const studentId of result.suspended ?? []) {
    const { data: student } = await supabase
      .from("students")
      .select("full_name, email, locked_price, locked_currency")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) continue;

    const amount = student.locked_price ?? 0;
    const currency = student.locked_currency ?? "CAD";

    await insertPaymentNotification(
      supabase,
      studentId,
      "access_suspended",
      `Your payment of ${currency} $${amount.toFixed(2)} is several days overdue, so your access has been temporarily paused. Your seat is still being held.`
    );

    await sendSubscriptionAccessSuspendedEmail(student.email, { fullName: student.full_name, amount, currency }).catch(
      () => undefined
    );
  }

  // A8 — day 14: SUSPENDED -> INACTIVE, seat released. Notify BEFORE
  // cancelling the Stripe subscription — the cancel below is what fires
  // customer.subscription.deleted a moment later, and that handler now
  // skips its own (different-wording) email for a student already
  // INACTIVE, specifically so this is the one email sent for this event.
  for (const row of result.inactivated ?? []) {
    const { data: student } = await supabase.from("students").select("full_name, email").eq("id", row.student_id).maybeSingle();
    if (student) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("phase_name")
        .eq("student_id", row.student_id)
        .eq("payment_mode", "subscription")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const courseName = enrollment?.phase_name ?? "your course";

      await insertPaymentNotification(
        supabase,
        row.student_id,
        "access_revoked",
        `Your payment for ${courseName} remained unpaid for two weeks, so your access has ended and your seat has been released.`
      );

      await sendSubscriptionAccessRevokedEmail(student.email, { fullName: student.full_name, courseName }).catch(() => undefined);
    }

    if (row.stripe_subscription_id) {
      await stripe.subscriptions.cancel(row.stripe_subscription_id).catch((err) => {
        console.error("[CronPaymentLifecycle] Failed to cancel Stripe subscription for", row.student_id, err);
      });
    }
  }

  for (const studentId of result.reminders ?? []) {
    const { data: student } = await supabase
      .from("students")
      .select("full_name, email, next_payment_due_at, locked_price, locked_currency")
      .eq("id", studentId)
      .maybeSingle();
    if (!student || !student.next_payment_due_at) continue;

    const daysOverdue = Math.floor(
      (Date.now() - new Date(student.next_payment_due_at).getTime()) / (24 * 60 * 60 * 1000)
    );
    await sendPaymentOverdueReminderEmail(student.email, {
      fullName: student.full_name,
      amount: student.locked_price ?? 0,
      currency: student.locked_currency ?? "CAD",
      daysOverdue,
    }).catch(() => undefined);
  }

  const reconciliation = await reconcileWithStripe(supabase, stripe);
  const existingStudentDigestSent = await sendExistingStudentDigestIfAny(supabase);
  const existingStudentDueNotices = await sendExistingStudentDueNoticesSafely(supabase);

  return NextResponse.json({
    ok: true,
    suspended: result.suspended?.length ?? 0,
    inactivated: result.inactivated?.length ?? 0,
    reminders: result.reminders?.length ?? 0,
    expired_holds_released: result.expired_holds_released ?? 0,
    reconciliation,
    existingStudentDigestSent,
    existingStudentDueNotices,
  });
}

/**
 * Checkpoint 3, item 6 — an informational heads-up email to admin, NOT the
 * real sweep: the daily job takes NO automatic action on existing
 * (non-Stripe) students (no reminders, no suspension, no inactivation —
 * that lifecycle is not built), so this only flags students who are
 * exactly 3 days past their due date so admin can catch a payment that
 * was received but never recorded. Respects all three rollout gates via
 * existing_student_lifecycle_eligible — with rollout 'off' (the default),
 * every student fails gate 1 and this is always empty — and the
 * protective enforcement rule (enforcementAllowed), which fails closed.
 */
async function sendExistingStudentDigestIfAny(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data: candidates } = await supabase
    .from("students")
    .select("id, full_name, email, next_payment_due, existing_lifecycle_announced_at")
    .is("stripe_subscription_id", null)
    .eq("status", "ACTIVE")
    .not("next_payment_due", "is", null);

  if (!candidates || candidates.length === 0) return 0;

  const today = new Date();
  const dueWithin24h = candidates.filter((c) => {
    const daysOverdue = Math.floor((today.getTime() - new Date(`${c.next_payment_due}T00:00:00Z`).getTime()) / (24 * 60 * 60 * 1000));
    return daysOverdue === 3;
  });
  if (dueWithin24h.length === 0) return 0;

  const eligible: { fullName: string; email: string; daysOverdue: number }[] = [];
  for (const c of dueWithin24h) {
    const { data: isEligible } = await supabase.rpc("existing_student_lifecycle_eligible", { p_student_id: c.id });
    if (!isEligible) continue;
    // Fails closed: no announced-at, or a due date inside the 7-day
    // protective window after enabling, means this student is left out.
    if (!enforcementAllowed({ nextPaymentDue: c.next_payment_due, announcedAt: c.existing_lifecycle_announced_at })) continue;
    eligible.push({ fullName: c.full_name, email: c.email, daysOverdue: 3 });
  }
  if (eligible.length === 0) return 0;

  const result = await sendExistingStudentDigest({ students: eligible });
  return result.sent ? eligible.length : 0;
}

/**
 * The neutral "payment due soon" notice for existing students. Wrapped so
 * a failure here can never turn an otherwise-complete sweep run into a 500.
 */
async function sendExistingStudentDueNoticesSafely(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  try {
    const result = await sendExistingStudentDueNotices(supabase, (n) =>
      sendExistingStudentDueSoonEmail(n.to, {
        fullName: n.fullName,
        amount: n.amount,
        currency: n.currency,
        dueDateLabel: n.dueDateLabel,
        payUrl: `${getSiteUrl()}/student/subscription`,
      })
    );
    return result.notified;
  } catch (err) {
    console.error("[CronPaymentLifecycle] Existing-student due notices failed:", err);
    return 0;
  }
}

/**
 * Catches a missed webhook: for every student we still think is
 * ACTIVE/SUSPENDED, ask Stripe directly whether their subscription is
 * really still alive. Only ONE outcome is "clear-cut" enough to fix
 * automatically — Stripe says the subscription is canceled but we never
 * heard about it — handled by reusing handle_subscription_canceled,
 * exactly the same function customer.subscription.deleted itself calls.
 * Any OTHER mismatch (e.g. Stripe says past_due, we still show active) is
 * only logged for admin review — not guessed at.
 */
async function reconcileWithStripe(supabase: ReturnType<typeof createAdminClient>, stripe: ReturnType<typeof getStripeClient>) {
  const { data: students } = await supabase
    .from("students")
    .select("id, stripe_subscription_id, subscription_status")
    .not("stripe_subscription_id", "is", null)
    .in("status", ["ACTIVE", "SUSPENDED"]);

  let checked = 0;
  let autoFixed = 0;
  let mismatchesLogged = 0;

  for (const student of students ?? []) {
    checked += 1;
    let realStatus: string;
    try {
      const sub = await stripe.subscriptions.retrieve(student.stripe_subscription_id!);
      realStatus = sub.status;
    } catch (err) {
      console.error("[CronPaymentLifecycle] Could not retrieve subscription for reconciliation:", student.id, err);
      continue;
    }

    if (realStatus === student.subscription_status) continue;

    if (realStatus === "canceled") {
      const { data: result } = await supabase.rpc("handle_subscription_canceled", {
        p_stripe_subscription_id: student.stripe_subscription_id!,
      });
      if (result?.ok) autoFixed += 1;
      continue;
    }

    await supabase.from("payment_events").insert({
      student_id: student.id,
      enrollment_id: null,
      event_type: "reconciliation_mismatch",
      amount: null,
      currency: null,
      stripe_event_id: null,
      created_by: null,
      note: `We show subscription_status='${student.subscription_status}', Stripe says '${realStatus}'. Not auto-fixed — needs review.`,
    });
    mismatchesLogged += 1;
  }

  return { checked, autoFixed, mismatchesLogged };
}
