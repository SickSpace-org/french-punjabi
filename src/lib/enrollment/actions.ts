"use server";

import { randomUUID } from "node:crypto";
import { createPublicClient } from "@/lib/supabase/server";
import { sendAdminNotification, sendEnrollmentConfirmation } from "@/lib/email/send";
import { validateEnrollmentFields } from "./validate";
import { generateEnrollmentRef } from "./ref";
import type { EnrollmentPayload, EnrollmentResult, EnrollmentOrCheckoutResult } from "./types";
import type { PaymentMode, PreferredContactMethod, ProgramOfferKey } from "@/types/database";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import { PERSONALISED_OFFER_KEY } from "@/data/personalisedOneOnOne";
import { hasOpenOneOnOneReservation, releaseReservedSlot, reserveOneOnOneSlot } from "@/lib/oneOnOne/slots";
import { getOneOnOneSlotInfo } from "@/lib/oneOnOne/guards";
import { isStripeEnrollEnabled } from "./stripeEnrollFlag";
import { createPublicEnrollCheckout } from "@/lib/payments/publicEnrollCheckout";

const CONTACT_METHODS: PreferredContactMethod[] = ["WhatsApp", "Phone Call", "Email"];

function toContactMethod(value: string): PreferredContactMethod {
  return CONTACT_METHODS.includes(value as PreferredContactMethod)
    ? (value as PreferredContactMethod)
    : "Email";
}

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
  phases: { title: string } | null;
  levels: { phase_id: string; name: string; phases: { title: string } | null } | null;
};

type DuplicateEnrollment = {
  id: string;
  enrollment_ref: string;
  amount_due: number;
  currency: string;
  full_name: string;
};

/**
 * The only entry point for saving an enrollment application. Runs entirely
 * server-side (Server Action) so RESEND_API_KEY and Supabase writes never
 * touch the browser. Re-derives everything about the selected phase/level/
 * batch AND its price from the database — the client's display strings
 * (phase/batch/timing labels, fee labels) are for UI only and are never
 * trusted here. Payment itself is never processed here either: this only
 * records what is owed (amount_due) so the student can be shown Interac
 * e-Transfer instructions; only an admin can later mark it paid.
 */
export async function submitEnrollment(payload: EnrollmentPayload): Promise<EnrollmentResult> {
  const fieldErrors = validateEnrollmentFields(payload);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "validation", fieldErrors };
  }

  const supabase = createPublicClient();

  let phaseId: string | null = null;
  let levelId: string | null = null;
  let batchId: string | null = null;
  let programOfferKey: ProgramOfferKey | null = null;
  let isOneOnOne = false;
  let phaseName: string;
  let levelName: string | null = null;
  let batchTiming: string;
  let paymentMode: PaymentMode | null = null;
  let amountDue: number;
  let currency: string;

  if (payload.batchId) {
    const { data, error } = await supabase
      .from("batches")
      .select(
        "id, phase_id, level_id, name, time_label, timezone, is_active, availability_status, total_slots, filled_slots, phases ( title ), levels ( phase_id, name, phases ( title ) )"
      )
      .eq("id", payload.batchId)
      .maybeSingle();

    const batch = data as unknown as BatchLookupRow | null;
    // Read separately (and tolerantly) so ordinary enrollments keep working even
    // before supabase/067 has been run. A reserved one-on-one slot sits in
    // held_slots until payment is confirmed, so it must count against the seat
    // here or a second person could submit for it.
    const slotInfo = batch ? await getOneOnOneSlotInfo(supabase, batch.id) : { isOneOnOne: false, held: 0 };
    const seatsLeft =
      batch?.total_slots != null ? batch.total_slots - batch.filled_slots - (slotInfo.isOneOnOne ? slotInfo.held : 0) : null;

    if (
      error ||
      !batch ||
      !batch.is_active ||
      batch.availability_status === "full" ||
      seatsLeft === 0 ||
      (seatsLeft ?? 0) < 0
    ) {
      return { ok: false, error: "batch_unavailable" };
    }

    const resolvedPhaseTitle = batch.phases?.title ?? batch.levels?.phases?.title ?? null;
    if (!resolvedPhaseTitle) {
      // Parent phase/level isn't publicly visible (e.g. deactivated) — treat
      // the same as an unavailable batch rather than saving incomplete data.
      return { ok: false, error: "batch_unavailable" };
    }

    // The batch itself may only carry level_id (Phase 1/2 timings) with no
    // phase_id — resolve through the level to find the phase it actually
    // belongs to, for pricing AND for what gets stored on the enrollment.
    // Storing batch.phase_id here directly used to leave phase_id null for
    // every level-nested enrollment (Foundation/TEF-TCF Prep — most
    // students), which made the live name resolver treat their perfectly
    // live phase as deleted (shown as "Foundation (removed)" on Students).
    const pricingPhaseId = batch.phase_id ?? batch.levels?.phase_id ?? null;

    batchId = batch.id;
    phaseId = pricingPhaseId;
    levelId = batch.level_id;
    phaseName = resolvedPhaseTitle;
    levelName = batch.levels?.name ?? null;
    batchTiming = formatBatchTiming(batch);

    isOneOnOne = slotInfo.isOneOnOne;

    if (isOneOnOne) {
      // One-on-one slots are always the monthly personalised price, the same for
      // every phase, so it comes from the program offer, never the phase's own
      // pricing and never from the client.
      paymentMode = "monthly";
      const { data: offer, error: offerError } = await supabase
        .from("program_offers")
        .select("is_active, base_price, display_total, currency")
        .eq("key", PERSONALISED_OFFER_KEY)
        .maybeSingle();

      if (offerError || !offer || !offer.is_active) {
        return { ok: false, error: "pricing_unavailable" };
      }
      amountDue = Number(offer.display_total ?? offer.base_price);
      currency = offer.currency;
    } else {
      paymentMode = payload.paymentMode === "monthly" ? "monthly" : "full";

      const { data: pricingRow, error: pricingError } = await supabase
        .from("pricing")
        .select("base_price, tax_rate, display_total, currency")
        .eq("phase_id", pricingPhaseId ?? "")
        .eq("payment_mode", paymentMode)
        .maybeSingle();

      if (pricingError || !pricingRow) {
        return { ok: false, error: "pricing_unavailable" };
      }

      amountDue = Number(pricingRow.display_total);
      currency = pricingRow.currency;
    }
  } else if (payload.programOfferKey) {
    // The personalised one-on-one is only bookable through a specific slot
    // (batchId), and the retired Calendly one-on-one is no longer offered.
    if (payload.programOfferKey === PERSONALISED_OFFER_KEY || payload.programOfferKey === "one_on_one_testing") {
      return { ok: false, error: "offer_unavailable" };
    }

    const { data: offer, error } = await supabase
      .from("program_offers")
      .select("key, label, is_active, base_price, display_total, currency")
      .eq("key", payload.programOfferKey)
      .maybeSingle();

    if (error || !offer || !offer.is_active) {
      return { ok: false, error: "offer_unavailable" };
    }

    programOfferKey = offer.key;
    phaseName = offer.label;
    batchTiming = "Timing confirmed after enrollment";
    amountDue = Number(offer.display_total ?? offer.base_price);
    currency = offer.currency;
  } else {
    return { ok: false, error: "missing_selection" };
  }

  const email = payload.email.trim().toLowerCase();
  const fullName = payload.fullName.trim();

  const { data: duplicate } = await supabase.rpc("enrollment_recent_duplicate", {
    p_email: email,
    p_batch_id: batchId,
    p_program_offer_key: programOfferKey,
  });

  if (duplicate) {
    // Accidental double submission — the original save (and its email) is
    // already handled. Report success again (with the original reference
    // and amount) without inserting a duplicate.
    const d = duplicate as DuplicateEnrollment;
    return {
      ok: true,
      emailSent: true,
      email,
      firstName: d.full_name.split(" ")[0] || d.full_name,
      enrollmentRef: d.enrollment_ref,
      amountDue: Number(d.amount_due),
      currency: d.currency,
    };
  }

  // One open reservation per person, so nobody can hold several slots at once
  // (or lock the whole list) while they decide.
  if (isOneOnOne && (await hasOpenOneOnOneReservation(email))) {
    return { ok: false, error: "already_reserved" };
  }

  // First come, first served: take the one-on-one slot atomically, now that every
  // other check has passed. If someone else submitted a moment ago this fails and
  // the student is told the slot is gone, before any enrollment row exists.
  if (isOneOnOne && batchId && !(await reserveOneOnOneSlot(batchId))) {
    return { ok: false, error: "batch_unavailable" };
  }

  // The anon role has no SELECT policy on enrollments, so `.select().single()`
  // after the insert would fail even on success (RLS gates INSERT...RETURNING
  // too) — generate the id ourselves instead of reading it back.
  const enrollmentId = randomUUID();
  let enrollmentRef = generateEnrollmentRef();

  let insertError = null as { code?: string; message: string } | null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("enrollments").insert({
      id: enrollmentId,
      full_name: fullName,
      email,
      phone: payload.phone.trim(),
      country: payload.country.trim(),
      current_french_level: payload.frenchLevel || null,
      phase_id: phaseId,
      level_id: levelId,
      batch_id: batchId,
      program_offer_key: programOfferKey,
      phase_name: phaseName,
      level_name: levelName,
      batch_timing: batchTiming,
      preferred_contact_method: toContactMethod(payload.contactMethod),
      message: payload.message.trim() || null,
      enrollment_ref: enrollmentRef,
      payment_mode: paymentMode,
      amount_due: amountDue,
      currency,
    });

    insertError = error;
    if (!error) break;
    // Unique-violation on the reference (astronomically unlikely) — retry
    // with a freshly generated one instead of failing the whole submission.
    if (error.code === "23505" && error.message.includes("enrollment_ref")) {
      enrollmentRef = generateEnrollmentRef();
      continue;
    }
    break;
  }

  if (insertError) {
    console.error("[Enrollment] Failed to save enrollment:", insertError);
    if (isOneOnOne && batchId) await releaseReservedSlot(batchId);
    return { ok: false, error: "save_failed" };
  }

  // The enrollment is saved at this point — everything below is best-effort
  // and must never make the student think their application was lost.
  const confirmation = await sendEnrollmentConfirmation(email, {
    fullName,
    phaseName,
    levelName,
    batchTiming,
    enrollmentRef,
    amountDue,
    currency,
  });

  await supabase.rpc("mark_enrollment_email_status", {
    p_id: enrollmentId,
    p_status: confirmation.sent ? "sent" : "failed",
  });

  void sendAdminNotification({
    fullName,
    phaseName,
    levelName,
    batchTiming,
    email,
    phone: payload.phone.trim(),
    enrollmentRef,
    amountDue,
    currency,
  });

  return {
    ok: true,
    emailSent: confirmation.sent,
    email,
    firstName: fullName.split(" ")[0] || fullName,
    enrollmentRef,
    amountDue,
    currency,
  };
}

/**
 * The public Enroll-page Stripe cutover's actual entry point — this is
 * what EnrollModal calls, not submitEnrollment directly. Off by default
 * (NEXT_PUBLIC_STRIPE_ENROLL_ENABLED unset or anything but "true"): falls
 * straight through to submitEnrollment above, completely untouched, same
 * call, same return shape — the manual flow behaves exactly as it does
 * today with zero code-path changes. On, AND a batchId was picked (not a
 * whole-program offer — those have no Stripe path yet, deliberately out
 * of scope for this cutover, and keep working through the manual flow
 * regardless of the flag): routes to Stripe Checkout instead and returns
 * a redirect URL.
 */
export async function submitEnrollmentOrCheckout(payload: EnrollmentPayload): Promise<EnrollmentOrCheckoutResult> {
  if (payload.manualOnly || !isStripeEnrollEnabled() || !payload.batchId) {
    return submitEnrollment(payload);
  }

  return createPublicEnrollCheckout({
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    country: payload.country,
    batchId: payload.batchId,
    termsAccepted: Boolean(payload.termsAccepted),
    paymentMode: payload.paymentMode === "monthly" ? "monthly" : "full",
    referralCode: payload.referralCode,
  });
}
