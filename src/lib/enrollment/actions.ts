"use server";

import { randomUUID } from "node:crypto";
import { createPublicClient } from "@/lib/supabase/server";
import { sendAdminNotification, sendEnrollmentConfirmation } from "@/lib/email/send";
import { validateEnrollmentFields } from "./validate";
import type { EnrollmentPayload, EnrollmentResult } from "./types";
import type { PaymentMode, PreferredContactMethod } from "@/types/database";

const CONTACT_METHODS: PreferredContactMethod[] = ["WhatsApp", "Phone Call", "Email"];
const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids ambiguous refs

function toContactMethod(value: string): PreferredContactMethod {
  return CONTACT_METHODS.includes(value as PreferredContactMethod)
    ? (value as PreferredContactMethod)
    : "Email";
}

/** e.g. "FP-2026-A7K4P2" — shown to the student and used by the admin to
 * match an incoming Interac e-Transfer to this enrollment. */
function generateEnrollmentRef(): string {
  const year = new Date().getFullYear();
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  }
  return `FP-${year}-${code}`;
}

type BatchLookupRow = {
  id: string;
  phase_id: string | null;
  level_id: string | null;
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
  let programOfferKey: "complete_program" | "redo_month" | "one_on_one_testing" | null = null;
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
        "id, phase_id, level_id, time_label, timezone, is_active, availability_status, total_slots, filled_slots, phases ( title ), levels ( phase_id, name, phases ( title ) )"
      )
      .eq("id", payload.batchId)
      .maybeSingle();

    const batch = data as unknown as BatchLookupRow | null;
    const seatsLeft = batch?.total_slots != null ? batch.total_slots - batch.filled_slots : null;

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

    batchId = batch.id;
    phaseId = batch.phase_id;
    levelId = batch.level_id;
    phaseName = resolvedPhaseTitle;
    levelName = batch.levels?.name ?? null;
    batchTiming = batch.timezone ? `${batch.time_label} ${batch.timezone}`.trim() : batch.time_label;

    // The batch itself may only carry level_id (Phase 1/2 timings) with no
    // phase_id — resolve through the level to find the phase whose pricing
    // actually applies.
    const pricingPhaseId = batch.phase_id ?? batch.levels?.phase_id ?? null;
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
  } else if (payload.programOfferKey) {
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
