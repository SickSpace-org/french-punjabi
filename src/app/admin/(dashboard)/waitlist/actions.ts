"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyWaitlist } from "@/lib/enrollment/waitlistNotify";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Relies on Supabase RLS (public.is_admin(), see supabase/030_batch_waitlist.sql)
 * as the real authorization boundary — a non-admin session's reads and
 * writes are rejected by the database regardless of this file.
 */

/** Emails everyone still waiting on this batch, even if it's still full. */
export async function emailWaitlistNow(batchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const sent = await notifyWaitlist(supabase, batchId, { onlyIfSeatOpen: false });
  revalidatePath("/admin/waitlist");
  if (sent === 0) return { ok: false, error: "No emails were sent. Check the email settings and try again." };
  return { ok: true, message: `Emailed ${sent} student${sent === 1 ? "" : "s"}.` };
}

export async function removeWaitlistEntry(entryId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("batch_waitlist")
    .delete({ count: "exact" })
    .eq("id", entryId);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Couldn't remove this entry." };
  revalidatePath("/admin/waitlist");
  return { ok: true };
}
