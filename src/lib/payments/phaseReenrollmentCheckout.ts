"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/siteUrl";
import { generateEnrollmentRef } from "@/lib/enrollment/ref";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import { PHASE_LENGTH_SECONDS } from "./phaseLength";
import { evaluateReenrollEligibility, evaluateReenrollTiming, REENROLL_BLOCKED_MESSAGES, type ReenrollBlockedReason } from "./reenrollEligibility";
import { isPhaseReenrollmentEnabled } from "./phaseReenrollmentFlag";
import { formatTimestampMedium } from "@/lib/format/date";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

/**
 * An already-paying student buying a NEW phase (e.g. finished Phase 1,
 * now paying for Phase 2) — portal-only, authenticated. Distinct from
 * existingStudentCheckout.ts, which continues/catches-up payment on the
 * SAME enrollment at its already-locked amount; this one is always a new
 * enrollment, always priced at whatever the Courses tab shows for that
 * phase RIGHT NOW (never a carried-over locked price).
 *
 * Never grants a trial — this student already had theirs (or paid Full)
 * on an earlier phase, and the trial-dedupe system (email + card
 * fingerprint, see supabase/043_stripe_trial.sql) is specifically for
 * screening brand-new signups, not something to route a known existing
 * student through. A Monthly re-enrollment is capped to this phase's own
 * length (cancel_at, via src/lib/payments/phaseLength.ts) — the same cap
 * the initial signup's own subscription now carries too
 * (subscriptionCheckout.ts). If the student still has an active
 * subscription from their previous phase, the webhook cancels it the
 * moment this new one activates (see cancelOldSubscriptionIfAny in the
 * webhook route) — never two concurrent subscriptions for one student —
 * and releases their OLD batch's seat (see old_batch_id below), since
 * they're moving on and no longer occupying it.
 *
 * WHO is paying is never a client-supplied value anywhere in this file —
 * every exported entry point resolves the student from the authenticated
 * session (getCurrentStudent) and nothing else accepts a student id, so
 * there is no parameter an attacker could tamper with to pay for someone
 * else's account. Same for price and phase: paymentMode is the only
 * input describing WHAT to buy — amount comes from the live `pricing`
 * table, and phase comes from the chosen batch's own phase_id, never from
 * a separate client-supplied phase value that could disagree with it.
 *
 * Course CONTENT access in this app is global (any active student sees
 * every published course — see StudentCoursesPage) — so this isn't about
 * unlocking anything. It's purely the billing event that keeps the
 * student's paid status current as they move through the program.
 */

type BatchRow = {
  id: string;
  phase_id: string | null;
  level_id: string | null;
  name: string | null;
  time_label: string;
  timezone: string;
  is_active: boolean;
  availability_status: string;
  total_slots: number | null;
  filled_slots: number;
  held_slots: number;
  phases: { title: string } | null;
  levels: { phase_id: string; name: string; phases: { title: string } | null } | null;
};

type SupaClient = SupabaseClient<Database>;

/** The student's current paid phase — its batch (to release the moment
 * their new phase activates, since they're moving on and no longer
 * occupying it) and when it was paid for (the Option A timing gate's
 * reference point, see evaluateReenrollTiming). Null for a student with
 * no prior paid enrollment (shouldn't normally happen — re-enrollment
 * implies a prior phase — but handled rather than assumed). */
async function getCurrentPaidEnrollment(supabase: SupaClient, studentId: string): Promise<{ batchId: string | null; paidAt: string | null } | null> {
  const { data } = await supabase
    .from("enrollments")
    .select("batch_id, paid_at")
    .eq("student_id", studentId)
    .eq("status", "ENROLLED")
    .eq("payment_status", "PAID")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { batchId: data.batch_id, paidAt: data.paid_at };
}

function reenrollTooEarlyMessage(eligibleOn: Date): string {
  return `You can enroll in a new phase starting ${formatTimestampMedium(eligibleOn.toISOString())} — you're still within your current phase.`;
}

/** True for a student who has never been Stripe-managed at all — the same
 * population existingStudentCheckout.ts serves (its own eligibility check
 * uses the identical signal: stripe_subscription_id is null). A
 * phase_completed student is explicitly EXCLUDED even though their
 * stripe_subscription_id is also null right now (cleared on completion,
 * see supabase/056_inactive_reason.sql) — they definitely went through
 * Stripe once; inactive_reason is what tells the two apart. */
function isPreStripeExistingStudent(student: Pick<StudentRow, "stripe_subscription_id" | "inactive_reason">): boolean {
  return student.stripe_subscription_id === null && student.inactive_reason !== "phase_completed";
}

/** The second gate "Gate it on both" refers to: re-enrollment is behind
 * its OWN flag (isPhaseReenrollmentEnabled) for everyone, but a student
 * who has never been Stripe-managed ALSO needs the existing-student
 * rollout switch (app_config.existing_student_rollout, see
 * supabase/052_existing_student_rollout.sql) to be anything other than
 * 'off' — the business's existing control for exposing new Stripe-era
 * capabilities to that specific, not-yet-fully-migrated population,
 * reused here rather than duplicated. A Stripe-native student (including
 * a phase_completed one) never needs this second check. */
async function preStripeRolloutAllows(supabase: SupaClient, student: StudentRow): Promise<boolean> {
  if (!isPreStripeExistingStudent(student)) return true;
  const { data: config } = await supabase.from("app_config").select("existing_student_rollout").eq("id", "singleton").maybeSingle();
  return (config?.existing_student_rollout ?? "off") !== "off";
}

export type ReenrollBatchOption = {
  id: string;
  label: string;
  phaseId: string;
  seatsLeft: number | null;
  disabled: boolean;
};

export type ReenrollOptionsResult =
  | { ok: true; batches: ReenrollBatchOption[] }
  | { ok: false; error: string; blockedReason?: ReenrollBlockedReason | "too_early" };

export async function getReenrollmentOptions(): Promise<ReenrollOptionsResult> {
  if (!isPhaseReenrollmentEnabled()) return { ok: false, error: "Re-enrollment isn't available yet." };

  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Please sign in again." };

  if (!(await preStripeRolloutAllows(supabase, student))) {
    return { ok: false, error: "Re-enrollment isn't available yet." };
  }

  const eligibility = evaluateReenrollEligibility(student);
  if (!eligibility.eligible) {
    return { ok: false, error: REENROLL_BLOCKED_MESSAGES[eligibility.reason], blockedReason: eligibility.reason };
  }

  const currentEnrollment = await getCurrentPaidEnrollment(supabase, student.id);
  const timing = evaluateReenrollTiming(currentEnrollment?.paidAt ?? null);
  if (!timing.allowed) {
    return { ok: false, error: reenrollTooEarlyMessage(timing.eligibleOn), blockedReason: "too_early" };
  }

  const { data: paidPhaseRows } = await supabase
    .from("enrollments")
    .select("phase_id")
    .eq("student_id", student.id)
    .eq("status", "ENROLLED")
    .eq("payment_status", "PAID");
  const paidPhaseIds = new Set((paidPhaseRows ?? []).map((r) => r.phase_id).filter((id): id is string => Boolean(id)));

  const { data } = await supabase
    .from("batches")
    .select(
      "id, phase_id, level_id, name, time_label, timezone, is_active, availability_status, total_slots, filled_slots, held_slots, phases ( title ), levels ( phase_id, name, phases ( title ) )"
    )
    .eq("is_active", true)
    .order("display_order");

  const batches: ReenrollBatchOption[] = ((data as unknown as BatchRow[]) ?? [])
    .map((b) => ({ b, phaseId: b.phase_id ?? b.levels?.phase_id ?? null }))
    .filter((row): row is { b: BatchRow; phaseId: string } => Boolean(row.phaseId) && !paidPhaseIds.has(row.phaseId!))
    .map(({ b, phaseId }) => {
      const phaseTitle = b.phases?.title ?? b.levels?.phases?.title ?? "Unknown Phase";
      const label = `${phaseTitle}${b.levels?.name ? ` — ${b.levels.name}` : ""} — ${b.name ? `${b.name} — ` : ""}${b.time_label} ${b.timezone}`;
      const seatsLeft = b.total_slots != null ? b.total_slots - b.filled_slots - b.held_slots : null;
      return {
        id: b.id,
        label,
        phaseId,
        seatsLeft,
        disabled: b.availability_status === "full" || b.availability_status === "hidden" || seatsLeft === 0,
      };
    });

  return { ok: true, batches };
}

export type ReenrollCheckoutResult = { ok: true; redirectUrl: string } | { ok: false; error: string };

export async function createPhaseReenrollmentCheckout(
  batchId: string,
  paymentMode: "full" | "monthly"
): Promise<ReenrollCheckoutResult> {
  // Re-checked here too, not just in getReenrollmentOptions — that one
  // only gates what's shown; this is the one that actually spends money,
  // so it must never trust that the UI already enforced either gate.
  if (!isPhaseReenrollmentEnabled()) return { ok: false, error: "Re-enrollment isn't available yet." };

  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Please sign in again." };

  if (!(await preStripeRolloutAllows(supabase, student))) {
    return { ok: false, error: "Re-enrollment isn't available yet." };
  }

  const eligibility = evaluateReenrollEligibility(student);
  if (!eligibility.eligible) {
    return { ok: false, error: REENROLL_BLOCKED_MESSAGES[eligibility.reason] };
  }

  const currentEnrollment = await getCurrentPaidEnrollment(supabase, student.id);
  const timing = evaluateReenrollTiming(currentEnrollment?.paidAt ?? null);
  if (!timing.allowed) {
    return { ok: false, error: reenrollTooEarlyMessage(timing.eligibleOn) };
  }

  const currentBatchId = currentEnrollment?.batchId ?? null;
  if (batchId === currentBatchId) {
    return { ok: false, error: "That's your current batch — pick a different phase to enroll in." };
  }

  const { data } = await supabase
    .from("batches")
    .select(
      "id, phase_id, level_id, name, time_label, timezone, is_active, availability_status, total_slots, filled_slots, held_slots, phases ( title ), levels ( phase_id, name, phases ( title ) )"
    )
    .eq("id", batchId)
    .maybeSingle();

  const batch = data as unknown as BatchRow | null;
  const seatsLeft = batch?.total_slots != null ? batch.total_slots - batch.filled_slots - batch.held_slots : null;
  // 'hidden' and 'full' are explicit availability_status values; a
  // completed/retired batch and a hidden-from-the-public one are both
  // represented the same way in this schema (is_active = false) — there's
  // no separate "completed" state to check.
  if (!batch || !batch.is_active || batch.availability_status === "full" || batch.availability_status === "hidden" || (seatsLeft ?? 1) <= 0) {
    return { ok: false, error: "That batch isn't available anymore." };
  }

  // The phase being bought is DERIVED from the chosen batch, never a
  // separate client-supplied value — so there's no "batch that doesn't
  // belong to the chosen phase" to reject; that mismatch can't exist.
  const phaseId = batch.phase_id ?? batch.levels?.phase_id ?? null;
  const phaseName = batch.phases?.title ?? batch.levels?.phases?.title ?? null;
  if (!phaseId || !phaseName) return { ok: false, error: "That batch isn't available anymore." };

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", student.id)
    .eq("phase_id", phaseId)
    .eq("status", "ENROLLED")
    .eq("payment_status", "PAID")
    .maybeSingle();
  if (existing) return { ok: false, error: "You're already enrolled in this phase." };

  const levelName = batch.levels?.name ?? null;
  const batchTiming = formatBatchTiming(batch);

  // Always the CURRENT live price — never anything the browser could
  // supply, and never the student's old locked_price from a prior phase.
  const { data: pricingRow } = await supabase
    .from("pricing")
    .select("display_total, currency")
    .eq("phase_id", phaseId)
    .eq("payment_mode", paymentMode === "monthly" ? "monthly" : "full")
    .maybeSingle();
  if (!pricingRow) return { ok: false, error: "Pricing isn't set up for this phase yet." };

  const amountDue = Number(pricingRow.display_total);
  const currency = pricingRow.currency;

  const enrollmentId = randomUUID();
  const enrollmentRef = generateEnrollmentRef();

  const { error: insertError } = await supabase.from("enrollments").insert({
    id: enrollmentId,
    student_id: student.id,
    full_name: student.full_name,
    email: student.email,
    phone: student.phone,
    country: student.country,
    current_french_level: null,
    phase_id: phaseId,
    level_id: batch.level_id,
    batch_id: batch.id,
    program_offer_key: null,
    phase_name: phaseName,
    level_name: levelName,
    batch_timing: batchTiming,
    preferred_contact_method: "Email",
    message: "Re-enrollment for a new phase.",
    enrollment_ref: enrollmentRef,
    payment_mode: paymentMode === "monthly" ? "subscription" : "full",
    amount_due: amountDue,
    currency,
  });
  if (insertError) {
    console.error("[PhaseReenrollmentCheckout] Failed to save enrollment:", insertError);
    return { ok: false, error: "Could not start checkout. Please try again." };
  }

  // Exactly one hold, exactly once per checkout attempt — reserve_batch_seat
  // is the same atomic, race-safe mechanism every other enrollment path in
  // this app uses (see supabase/042_stripe_subscription_core.sql); a
  // second click while pending is blocked client-side (PhaseReenrollment.tsx
  // disables the button), and a genuinely duplicate submission would just
  // create a second independent hold/enrollment/session, not double-count
  // this one.
  const holdId = randomUUID();
  const { data: reserveResult, error: reserveError } = await supabase.rpc("reserve_batch_seat", {
    p_batch_id: batch.id,
    p_enrollment_id: enrollmentId,
    p_hold_id: holdId,
  });
  if (reserveError || !reserveResult?.ok) {
    return { ok: false, error: "That batch filled up just now — please pick another timing." };
  }

  const siteUrl = getSiteUrl();
  const stripe = getStripeClient();
  const oldSubscriptionId = student.stripe_subscription_id ?? undefined;
  // currentBatchId was already resolved above (and checked against this
  // batchId) — reused here rather than queried a second time.
  const releaseMetadata: Record<string, string> = currentBatchId ? { old_batch_id: currentBatchId } : {};

  try {
    if (paymentMode === "monthly") {
      // Stripe Checkout's subscription_data has no cancel_at field — the
      // webhook (handleCheckoutCompleted) reads this metadata value back
      // and applies it via a follow-up subscriptions.update() once the
      // subscription actually exists.
      const cancelAt = Math.floor(Date.now() / 1000) + PHASE_LENGTH_SECONDS;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: student.email,
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: { name: `${phaseName} — ${batchTiming}` },
              recurring: { interval: "month" },
              unit_amount: Math.round(amountDue * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          enrollment_id: enrollmentId,
          hold_id: holdId,
          batch_id: batch.id,
          cancel_at: String(cancelAt),
          ...(oldSubscriptionId ? { old_subscription_id: oldSubscriptionId } : {}),
          ...releaseMetadata,
        },
        payment_method_collection: "always",
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${siteUrl}/student/subscription?reenroll=success`,
        cancel_url: `${siteUrl}/student/subscription?reenroll=cancelled`,
      });
      if (!session.url) {
        await supabase.rpc("release_batch_seat_hold", { p_hold_id: holdId });
        return { ok: false, error: "Could not start checkout. Please try again." };
      }
      return { ok: true, redirectUrl: session.url };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: student.email,
      customer_creation: "always",
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: `${phaseName} — ${batchTiming}` },
            unit_amount: Math.round(amountDue * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        enrollment_id: enrollmentId,
        hold_id: holdId,
        batch_id: batch.id,
        payment_mode: "full",
        ...(oldSubscriptionId ? { old_subscription_id: oldSubscriptionId } : {}),
        ...releaseMetadata,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${siteUrl}/student/subscription?reenroll=success`,
      cancel_url: `${siteUrl}/student/subscription?reenroll=cancelled`,
    });
    if (!session.url) {
      await supabase.rpc("release_batch_seat_hold", { p_hold_id: holdId });
      return { ok: false, error: "Could not start checkout. Please try again." };
    }
    return { ok: true, redirectUrl: session.url };
  } catch (err) {
    console.error("[PhaseReenrollmentCheckout] Stripe session creation failed:", err);
    await supabase.rpc("release_batch_seat_hold", { p_hold_id: holdId });
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
}
