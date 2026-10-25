"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { createPublicClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/siteUrl";
import { validateEnrollmentFields } from "@/lib/enrollment/validate";
import { generateEnrollmentRef } from "@/lib/enrollment/ref";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import { ensureReferralCoupons, REFERRED_DISCOUNT_COUPON_ID } from "./referralCoupons";
import { PHASE_LENGTH_SECONDS } from "./phaseLength";
import type { SubscriptionCheckoutPayload, SubscriptionCheckoutResult } from "./types";

type BatchLookupRow = {
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

/**
 * Stage 1 only — not wired into the public EnrollModal. Reached only from
 * the unlinked test page (src/app/test-stripe-subscription) until wiring
 * this into real public UI is its own explicit decision. Reuses the
 * existing enrollments table exactly like submitEnrollment() does, with
 * payment_mode = 'subscription' instead of the Interac 'full'/'monthly'.
 *
 * Capacity is checked TWICE: once here (soft, fast-fail before ever
 * touching Stripe) and once more, atomically, inside reserve_batch_seat()
 * (the real guarantee — see supabase/042_stripe_subscription_core.sql).
 */
export async function createSubscriptionCheckout(
  payload: SubscriptionCheckoutPayload,
  /** Public Enroll cutover (behind NEXT_PUBLIC_STRIPE_ENROLL_ENABLED) passes
   * its own success/cancel URLs; every existing caller (the test page)
   * omits this and keeps landing on /test-stripe-subscription/success
   * exactly as before — purely additive, default preserves current
   * behavior byte-for-byte. */
  urls?: { successUrl: string; cancelUrl: string }
): Promise<SubscriptionCheckoutResult> {
  const fieldErrors = validateEnrollmentFields(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "validation", fieldErrors };
  }
  if (!payload.termsAccepted) {
    return { ok: false, error: "terms_not_accepted" };
  }

  const supabase = createPublicClient();

  const { data, error: batchError } = await supabase
    .from("batches")
    .select(
      "id, phase_id, level_id, name, time_label, timezone, is_active, availability_status, total_slots, filled_slots, held_slots, phases ( title ), levels ( phase_id, name, phases ( title ) )"
    )
    .eq("id", payload.batchId)
    .maybeSingle();

  const batch = data as unknown as BatchLookupRow | null;
  const seatsLeft =
    batch?.total_slots != null ? batch.total_slots - batch.filled_slots - batch.held_slots : null;

  if (
    batchError ||
    !batch ||
    !batch.is_active ||
    batch.availability_status === "full" ||
    batch.availability_status === "hidden" ||
    (seatsLeft ?? 1) <= 0
  ) {
    return { ok: false, error: "batch_unavailable" };
  }

  const resolvedPhaseTitle = batch.phases?.title ?? batch.levels?.phases?.title ?? null;
  if (!resolvedPhaseTitle) {
    return { ok: false, error: "batch_unavailable" };
  }

  const pricingPhaseId = batch.phase_id ?? batch.levels?.phase_id ?? null;
  const phaseName = resolvedPhaseTitle;
  const levelName = batch.levels?.name ?? null;
  const batchTiming = formatBatchTiming(batch);

  // Stage 1 reuses the existing 'monthly' pricing row's amount as the new
  // recurring Stripe subscription price — flagged explicitly in the Stage 1
  // notes as a mapping decision, not a confirmed business rule.
  //
  // KNOWN OPEN ISSUE (reported, not yet fixed — pending a client decision
  // on tax-inclusive-locked-price vs. base-price-plus-Stripe-Tax): this
  // reads display_total, the tax-INCLUDED total (base_price * (1 +
  // tax_rate)), which is what ends up stored as students.locked_price.
  // See the Stage 1 Q&A for the full writeup.
  const { data: pricingRow, error: pricingError } = await supabase
    .from("pricing")
    .select("base_price, display_total, currency")
    .eq("phase_id", pricingPhaseId ?? "")
    .eq("payment_mode", "monthly")
    .maybeSingle();

  if (pricingError || !pricingRow) {
    return { ok: false, error: "pricing_unavailable" };
  }

  const amountDue = Number(pricingRow.display_total);
  const currency = pricingRow.currency;

  const { data: termsVersion, error: termsError } = await supabase
    .from("terms_versions")
    .select("id")
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (termsError || !termsVersion) {
    return { ok: false, error: "save_failed" };
  }

  const email = payload.email.trim().toLowerCase();
  const fullName = payload.fullName.trim();

  // Stage 2 — every new signup starts with a 7-day trial, so this is the
  // email half of trial dedupe: checked BEFORE any enrollment row or
  // Stripe object exists, so a repeat email is blocked outright, before
  // ever reaching Stripe. The card-fingerprint half can only be checked
  // reactively in the webhook — see activate_subscription_enrollment.
  const { data: alreadyUsedTrial, error: trialCheckError } = await supabase.rpc("has_used_trial_email", {
    p_email_key: email,
  });
  if (trialCheckError) {
    console.error("[SubscriptionCheckout] Trial dedupe check failed:", trialCheckError);
    return { ok: false, error: "save_failed" };
  }
  if (alreadyUsedTrial) {
    return { ok: false, error: "trial_already_used" };
  }

  const enrollmentId = randomUUID();
  const enrollmentRef = generateEnrollmentRef();

  const { error: insertError } = await supabase.from("enrollments").insert({
    id: enrollmentId,
    full_name: fullName,
    email,
    phone: payload.phone.trim(),
    country: payload.country.trim(),
    current_french_level: null,
    phase_id: pricingPhaseId,
    level_id: batch.level_id,
    batch_id: batch.id,
    program_offer_key: null,
    phase_name: phaseName,
    level_name: levelName,
    batch_timing: batchTiming,
    preferred_contact_method: "Email",
    message: null,
    enrollment_ref: enrollmentRef,
    payment_mode: "subscription",
    amount_due: amountDue,
    currency,
  });

  if (insertError) {
    console.error("[SubscriptionCheckout] Failed to save enrollment:", insertError);
    return { ok: false, error: "save_failed" };
  }

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const { error: termsAcceptError } = await supabase.from("terms_acceptances").insert({
    enrollment_id: enrollmentId,
    terms_version_id: termsVersion.id,
    ip_address: ipAddress,
  });

  if (termsAcceptError) {
    console.error("[SubscriptionCheckout] Failed to save terms acceptance:", termsAcceptError);
    return { ok: false, error: "save_failed" };
  }

  // A6 — referral redemption. A code that doesn't resolve, or belongs to
  // the person signing up themselves (self-referral), is silently
  // ignored rather than failing the whole checkout over it.
  let referralApplied = false;
  const trimmedCode = payload.referralCode?.trim().toUpperCase();
  if (trimmedCode) {
    const { data: referrer } = await supabase.from("students").select("id, email").eq("referral_code", trimmedCode).maybeSingle();
    if (referrer && referrer.email.toLowerCase() !== email) {
      const { data: redeemResult } = await supabase.rpc("redeem_referral_code", {
        p_code: trimmedCode,
        p_enrollment_id: enrollmentId,
      });
      referralApplied = Boolean(redeemResult?.ok);
    }
  }

  const holdId = randomUUID();
  const { data: reserveResult, error: reserveError } = await supabase.rpc("reserve_batch_seat", {
    p_batch_id: batch.id,
    p_enrollment_id: enrollmentId,
    p_hold_id: holdId,
  });

  if (reserveError || !reserveResult?.ok) {
    return { ok: false, error: "batch_unavailable" };
  }

  // Strict allowlist (see src/lib/siteUrl.ts) — never derived from request
  // headers, which are attacker-controllable (a spoofed Host/Origin header
  // could otherwise redirect Checkout's success/cancel flow off-domain).
  const siteUrl = getSiteUrl();

  if (referralApplied) {
    await ensureReferralCoupons();
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
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
        // Caps this subscription to the phase's own length — Checkout's
        // subscription_data has no cancel_at field at creation time, so
        // handleCheckoutCompleted reads this back and applies it via a
        // follow-up subscriptions.update() once the subscription exists
        // (same mechanism phase re-enrollment uses). Without this, nothing
        // ever stops the monthly charge once the student's 3 months of
        // this phase are over.
        cancel_at: String(Math.floor(Date.now() / 1000) + PHASE_LENGTH_SECONDS),
      },
      // Decision 1: 7-day free trial, card collected upfront, first charge
      // automatic on day 8 — all driven by Stripe's own billing engine from
      // here on, nothing in this app schedules the day-8 charge itself.
      subscription_data: { trial_period_days: 7 },
      payment_method_collection: "always",
      // A5 — Stripe's own hosted Checkout shows an "Add promotion code"
      // field and validates/applies it itself; nothing on our side ever
      // sees or checks a code. Codes themselves are Stripe Coupons /
      // Promotion Codes, created in the Dashboard, not in this app.
      //
      // A6 — Stripe doesn't allow allow_promotion_codes together with a
      // pre-set `discounts` on the same session, so a successful referral
      // takes priority and the general promo-code field is dropped for
      // that one checkout — can't combine a referral AND a separate
      // promo code in a single signup.
      ...(referralApplied
        ? { discounts: [{ coupon: REFERRED_DISCOUNT_COUPON_ID }] }
        : { allow_promotion_codes: true }),
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: urls?.successUrl ?? `${siteUrl}/test-stripe-subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: urls?.cancelUrl ?? `${siteUrl}/test-stripe-subscription?cancelled=1`,
    });

    if (!session.url) {
      await supabase.rpc("release_batch_seat_hold", { p_hold_id: holdId });
      return { ok: false, error: "checkout_failed" };
    }

    return { ok: true, redirectUrl: session.url };
  } catch (err) {
    console.error("[SubscriptionCheckout] Stripe session creation failed:", err);
    await supabase.rpc("release_batch_seat_hold", { p_hold_id: holdId });
    return { ok: false, error: "checkout_failed" };
  }
}
