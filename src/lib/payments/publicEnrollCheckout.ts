"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { createPublicClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/siteUrl";
import { validateEnrollmentFields } from "@/lib/enrollment/validate";
import { generateEnrollmentRef } from "@/lib/enrollment/ref";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import { createSubscriptionCheckout } from "./subscriptionCheckout";
import type { SubscriptionCheckoutResult } from "./types";

export type PublicEnrollCheckoutPayload = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  batchId: string;
  termsAccepted: boolean;
  paymentMode: "full" | "monthly";
  /** Monthly only — see the note where this is read below. */
  referralCode?: string;
};

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
 * The public Enroll-page Stripe cutover's single entry point — gated
 * behind NEXT_PUBLIC_STRIPE_ENROLL_ENABLED by its only caller
 * (submitEnrollmentOrCheckout). Branches on payload.paymentMode:
 *   - 'monthly': the already-proven 7-day-trial subscription flow
 *     (createSubscriptionCheckout, unchanged — just given this page's own
 *     success/cancel URLs instead of the test page's).
 *   - 'full': a NEW one-time payment, no trial, no subscription. Referral
 *     codes are deliberately not offered on this path — the referrer-credit
 *     mechanism only ever triggers off invoice.payment_succeeded
 *     (billing_reason), which a one-time payment.session never fires, so
 *     accepting a code here would silently never pay out the referrer.
 *     Extending referrals to one-time payments is its own separate piece
 *     of work, not something to half-build silently.
 */
export async function createPublicEnrollCheckout(payload: PublicEnrollCheckoutPayload): Promise<SubscriptionCheckoutResult> {
  if (payload.paymentMode === "monthly") {
    const siteUrl = getSiteUrl();
    return createSubscriptionCheckout(
      {
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        country: payload.country,
        batchId: payload.batchId,
        termsAccepted: payload.termsAccepted,
        referralCode: payload.referralCode,
      },
      {
        successUrl: `${siteUrl}/enroll/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${siteUrl}/courses?cancelled=1`,
      }
    );
  }

  return createOneTimeEnrollCheckout(payload);
}

async function createOneTimeEnrollCheckout(payload: PublicEnrollCheckoutPayload): Promise<SubscriptionCheckoutResult> {
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
  const seatsLeft = batch?.total_slots != null ? batch.total_slots - batch.filled_slots - batch.held_slots : null;

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

  const { data: pricingRow, error: pricingError } = await supabase
    .from("pricing")
    .select("display_total, currency")
    .eq("phase_id", pricingPhaseId ?? "")
    .eq("payment_mode", "full")
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
    payment_mode: "full",
    amount_due: amountDue,
    currency,
  });

  if (insertError) {
    console.error("[PublicEnrollCheckout] Failed to save enrollment:", insertError);
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
    console.error("[PublicEnrollCheckout] Failed to save terms acceptance:", termsAcceptError);
    return { ok: false, error: "save_failed" };
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

  const siteUrl = getSiteUrl();

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      // Payment-mode sessions don't create a Customer by default — force
      // it so the student row still gets a stripe_customer_id for
      // traceability/refund lookups, same as every other path in this app.
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
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${siteUrl}/enroll/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/courses?cancelled=1`,
    });

    if (!session.url) {
      await supabase.rpc("release_batch_seat_hold", { p_hold_id: holdId });
      return { ok: false, error: "checkout_failed" };
    }

    return { ok: true, redirectUrl: session.url };
  } catch (err) {
    console.error("[PublicEnrollCheckout] Stripe session creation failed:", err);
    await supabase.rpc("release_batch_seat_hold", { p_hold_id: holdId });
    return { ok: false, error: "checkout_failed" };
  }
}
