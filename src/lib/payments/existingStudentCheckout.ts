"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/siteUrl";

export type ExistingStudentCheckoutResult = { ok: true; redirectUrl: string } | { ok: false; error: string };

/** Checkpoint 3, item 2 — monthly amounts for every real existing student
 * surveyed are $224.87; this is generous headroom above that while still
 * catching an obviously wrong value (a stray extra digit, a full-program
 * total accidentally classified as monthly) rather than silently charging
 * it. Deliberately a flat ceiling, not derived from the current public
 * price — existing students may be on a different, grandfathered amount
 * by design. */
const UNUSUALLY_HIGH_THRESHOLD = 1000;

type EligibleStudentErrorReason = "not_authenticated" | "already_stripe_managed" | "not_eligible" | "no_enrollment" | "invalid_amount";

type EligibleStudentResolution =
  | { error: EligibleStudentErrorReason }
  | {
      student: NonNullable<Awaited<ReturnType<typeof getCurrentStudent>>>;
      enrollment: { id: string; amount_due: number; currency: string; phase_name: string; batch_timing: string };
      amount: number;
    };

async function resolveEligibleExistingStudent(supabase: Awaited<ReturnType<typeof createClient>>): Promise<EligibleStudentResolution> {
  const student = await getCurrentStudent(supabase);
  if (!student) return { error: "not_authenticated" };
  if (student.stripe_subscription_id) return { error: "already_stripe_managed" };

  const { data: eligible } = await supabase.rpc("existing_student_lifecycle_eligible", { p_student_id: student.id });
  if (!eligible) return { error: "not_eligible" };

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, amount_due, currency, phase_name, batch_timing")
    .eq("student_id", student.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!enrollment) return { error: "no_enrollment" };

  const amount = enrollment.amount_due;
  if (amount == null || amount <= 0 || amount > UNUSUALLY_HIGH_THRESHOLD) {
    return { error: "invalid_amount" };
  }

  return { student, enrollment, amount };
}

const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Please sign in again.",
  already_stripe_managed: "Your subscription is already managed through Stripe.",
  not_eligible: "Online payment isn't available for your account yet.",
  no_enrollment: "No enrollment found on your account.",
  invalid_amount: "Your account's amount due looks unusual — please contact us to pay.",
  checkout_failed: "Could not start checkout. Please try again.",
};

/** "Pay this month" — a one-time Checkout Session (mode: 'payment'), never
 * a subscription. Clears overdue and advances the due date one cycle on
 * success (see record_existing_student_stripe_payment, migration 053). */
export async function payThisMonth(): Promise<ExistingStudentCheckoutResult> {
  const supabase = await createClient();
  const resolved = await resolveEligibleExistingStudent(supabase);
  if ("error" in resolved) return { ok: false, error: ERROR_MESSAGES[resolved.error] ?? resolved.error };
  const { student, enrollment, amount } = resolved;

  const stripe = getStripeClient();
  const siteUrl = getSiteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: student.email,
    line_items: [
      {
        price_data: {
          currency: enrollment.currency.toLowerCase(),
          product_data: { name: `${enrollment.phase_name} — ${enrollment.batch_timing} — this month's payment` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { existing_student_id: student.id, enrollment_id: enrollment.id, payment_path: "one_time" },
    success_url: `${siteUrl}/student/subscription?payment=success`,
    cancel_url: `${siteUrl}/student/subscription?payment=cancelled`,
  });

  if (!session.url) return { ok: false, error: ERROR_MESSAGES.checkout_failed };
  return { ok: true, redirectUrl: session.url };
}

/** "Set up autopay" — a subscription Checkout Session whose first charge
 * is delayed to the student's EXISTING next_payment_due via
 * billing_cycle_anchor + proration_behavior: 'none' (verified live in
 * Stripe test mode to keep status 'active', never 'trialing' — no
 * trial_period_days anywhere in this function). Never charges immediately
 * for a month already paid.
 *
 * OPEN QUESTION, deliberately not decided here: should this ALSO get the
 * 90-day phase cap (src/lib/payments/phaseLength.ts) the initial signup
 * and phase re-enrollment both now carry? This student is an existing,
 * pre-Stripe enrollment being moved onto Stripe mid-flight — this app has
 * no record of how much of their phase's 90 days has already elapsed, so
 * applying a fresh 90-day cap from TODAY could be wrong in either
 * direction (too generous if they're already most of the way through
 * their phase, too short if they're early). Needs an actual answer, not a
 * guess — not touched until there is one. */
export async function setUpAutopay(): Promise<ExistingStudentCheckoutResult> {
  const supabase = await createClient();
  const resolved = await resolveEligibleExistingStudent(supabase);
  if ("error" in resolved) return { ok: false, error: ERROR_MESSAGES[resolved.error] ?? resolved.error };
  const { student, enrollment, amount } = resolved;

  if (!student.next_payment_due) return { ok: false, error: ERROR_MESSAGES.not_eligible };
  // 14:00 UTC (10:00 Toronto), not midnight: 00:00 UTC is 8pm the evening BEFORE in Toronto, which would
  // make Stripe (and every date shown from it) read one day early.
  const anchorUnix = Math.floor(new Date(`${student.next_payment_due}T14:00:00Z`).getTime() / 1000);
  if (anchorUnix <= Math.floor(Date.now() / 1000)) {
    return { ok: false, error: "Your due date needs to be in the future to set up autopay — please contact us." };
  }

  const stripe = getStripeClient();
  const siteUrl = getSiteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: student.email,
    line_items: [
      {
        price_data: {
          currency: enrollment.currency.toLowerCase(),
          product_data: { name: `${enrollment.phase_name} — ${enrollment.batch_timing}` },
          recurring: { interval: "month" },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    subscription_data: {
      billing_cycle_anchor: anchorUnix,
      proration_behavior: "none",
    },
    metadata: { existing_student_id: student.id, enrollment_id: enrollment.id, payment_path: "autopay" },
    success_url: `${siteUrl}/student/subscription?payment=success`,
    cancel_url: `${siteUrl}/student/subscription?payment=cancelled`,
  });

  if (!session.url) return { ok: false, error: ERROR_MESSAGES.checkout_failed };
  return { ok: true, redirectUrl: session.url };
}
