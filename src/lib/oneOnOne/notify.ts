"use server";

import { createPublicClient } from "@/lib/supabase/server";
import { sendAdminWaitlistNotification, sendWaitlistJoinedEmail } from "@/lib/email/send";
import { validateEnrollmentFields, type EnrollmentFieldErrors } from "@/lib/enrollment/validate";
import { ONE_ON_ONE_ANCHOR, PERSONALISED_TITLE } from "@/data/personalisedOneOnOne";

export type OneOnOneNotifyPayload = {
  /** Real `phases.id` — re-validated on the server. */
  phaseId: string;
  fullName: string;
  email: string;
  phone: string;
};

export type OneOnOneNotifyResult =
  | { ok: true; email: string; firstName: string }
  | { ok: false; error: "validation"; fieldErrors: EnrollmentFieldErrors }
  | { ok: false; error: "phase_unavailable" | "save_failed" };

/**
 * "Notify me when the next one-on-one batch opens". Used when a phase has no
 * open one-on-one slot. The phase is re-read from the database, never trusted
 * from the client, and signing up twice with the same email counts as success.
 */
export async function joinOneOnOneNotify(payload: OneOnOneNotifyPayload): Promise<OneOnOneNotifyResult> {
  const fieldErrors = validateEnrollmentFields({ ...payload, country: "-" });
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "validation", fieldErrors };
  }

  const supabase = createPublicClient();
  const { data: phase, error: phaseError } = await supabase
    .from("phases")
    .select("id, slug, title")
    .eq("id", payload.phaseId)
    .eq("is_active", true)
    .maybeSingle();
  if (phaseError || !phase) return { ok: false, error: "phase_unavailable" };

  const email = payload.email.trim().toLowerCase();
  const fullName = payload.fullName.trim();
  const phone = payload.phone.trim();

  const { error } = await supabase.from("one_on_one_notify").insert({
    phase_id: phase.id,
    full_name: fullName,
    email,
    phone,
  });

  const alreadyWaiting = error?.code === "23505";
  if (error && !alreadyWaiting) {
    console.error("[One-on-one] Failed to save notify request:", error);
    return { ok: false, error: "save_failed" };
  }

  if (!alreadyWaiting) {
    const courseName = `${phase.title} — ${PERSONALISED_TITLE}`;
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await sendWaitlistJoinedEmail(email, {
      fullName,
      courseName,
      batchTiming: "We'll email you when a new slot opens",
      enrollUrl: `${site}/courses/${phase.slug}#${ONE_ON_ONE_ANCHOR}`,
    });
    void sendAdminWaitlistNotification({
      fullName,
      email,
      phone,
      message: null,
      courseName,
      batchTiming: "Notify me when the next one-on-one batch opens",
    });
  }

  return { ok: true, email, firstName: fullName.split(" ")[0] || fullName };
}
