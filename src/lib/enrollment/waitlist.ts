"use server";

import { createPublicClient } from "@/lib/supabase/server";
import { sendAdminWaitlistNotification, sendWaitlistJoinedEmail } from "@/lib/email/send";
import { BATCH_SELECT, describeBatch, type WaitlistBatchRow } from "./waitlistNotify";
import { validateEnrollmentFields, type EnrollmentFieldErrors } from "./validate";

export type WaitlistPayload = {
  batchId: string;
  fullName: string;
  email: string;
  phone: string;
  message: string;
};

export type WaitlistResult =
  | { ok: true; email: string; firstName: string }
  | { ok: false; error: "validation"; fieldErrors: EnrollmentFieldErrors }
  | { ok: false; error: "batch_unavailable" | "save_failed" };

/**
 * A student asks to be told when a full batch has a free seat. Server-side
 * only — the batch is re-read from the database, never trusted from the
 * client. Joining twice with the same email is treated as success.
 */
export async function joinWaitlist(payload: WaitlistPayload): Promise<WaitlistResult> {
  const fieldErrors = validateEnrollmentFields({ ...payload, country: "-" });
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "validation", fieldErrors };
  }

  const supabase = createPublicClient();
  const { data, error: batchError } = await supabase
    .from("batches")
    .select(BATCH_SELECT)
    .eq("id", payload.batchId)
    .maybeSingle();
  const batch = data as unknown as WaitlistBatchRow | null;
  if (batchError || !batch || !batch.is_active) {
    return { ok: false, error: "batch_unavailable" };
  }

  const email = payload.email.trim().toLowerCase();
  const fullName = payload.fullName.trim();
  const phone = payload.phone.trim();
  const message = payload.message.trim() || null;

  const { error } = await supabase.from("batch_waitlist").insert({
    batch_id: batch.id,
    full_name: fullName,
    email,
    phone,
    message,
  });

  const alreadyWaiting = error?.code === "23505";
  if (error && !alreadyWaiting) {
    console.error("[Waitlist] Failed to save waitlist sign-up:", error);
    return { ok: false, error: "save_failed" };
  }

  if (!alreadyWaiting) {
    const info = describeBatch(batch);
    await sendWaitlistJoinedEmail(email, { fullName, ...info });
    void sendAdminWaitlistNotification({
      fullName,
      email,
      phone,
      message,
      courseName: info.courseName,
      batchTiming: info.batchTiming,
    });
  }

  return { ok: true, email, firstName: fullName.split(" ")[0] || fullName };
}
