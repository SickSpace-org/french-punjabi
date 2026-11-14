import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { reopenSlot } from "@/lib/oneOnOne/slots";
import { notifyOneOnOnePhase } from "@/lib/oneOnOne/notifyPhase";

/** How long a slot stays held for someone who hasn't paid. */
export const HOLD_HOURS = 48;

/**
 * Releases one-on-one slots that were reserved but never paid for within
 * HOLD_HOURS, so an abandoned (or malicious) reservation can't lock a slot
 * forever. The unpaid enrollment is marked "not interested" and the slot goes
 * back to open; anyone waiting for that phase is emailed. A hold with no live
 * enrollment behind it (the server died between reserving and saving) is
 * released on the same clock, using the slot's own last-update time.
 *
 * Never throws: it runs from a cron and from page loads, and a failure here
 * must not break either. Returns how many slots were released.
 */
export async function releaseStaleOneOnOneHolds(): Promise<number> {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - HOLD_HOURS * 60 * 60 * 1000).toISOString();

    const { data: held, error } = await admin
      .from("batches")
      .select("id, phase_id, updated_at")
      .eq("is_one_on_one", true)
      .gt("held_slots", 0);
    // Also the "column doesn't exist yet" case before supabase/067 is run.
    if (error || !held?.length) return 0;

    let released = 0;
    const phases = new Set<string>();
    for (const slot of held) {
      const { data: holder } = await admin
        .from("enrollments")
        .select("id, payment_status, created_at")
        .eq("batch_id", slot.id)
        .neq("status", "NOT_INTERESTED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (holder) {
        if (holder.payment_status !== "PENDING" || holder.created_at > cutoff) continue;
        await admin.from("enrollments").update({ status: "NOT_INTERESTED" }).eq("id", holder.id).eq("payment_status", "PENDING");
      } else if (slot.updated_at > cutoff) {
        continue;
      }

      const result = await reopenSlot(slot.id);
      if (result.ok) {
        released += 1;
        if (slot.phase_id) phases.add(slot.phase_id);
      }
    }

    for (const phaseId of phases) await notifyOneOnOnePhase(admin, phaseId);
    if (released > 0) {
      revalidatePath("/admin/one-on-one");
      revalidatePath("/courses", "layout");
    }
    return released;
  } catch (error) {
    console.error("[One-on-one] Failed to release stale holds:", error);
    return 0;
  }
}

let lastSweep = 0;

/** At most one sweep per 10 minutes per server instance, for running on public page loads. */
export async function sweepStaleHoldsThrottled(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < 10 * 60 * 1000) return;
  lastSweep = now;
  await releaseStaleOneOnOneHolds();
}
