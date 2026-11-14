import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Seat bookkeeping for one-on-one slots (one-seat batches flagged
 * is_one_on_one). A slot moves through three states:
 *
 *   open      availability_status available, held 0, filled 0
 *   reserved  someone submitted the enroll form: held_slots = 1, status "full"
 *             (first come, first served; nobody else can take it)
 *   taken     the admin confirmed their payment: filled_slots = 1, held 0
 *
 * An admin puts a reserved or taken slot back to open with reopenSlot (for
 * example when a student quits). These run with the service-role client
 * because the visitor submitting the form is anonymous; every caller has
 * already validated the batch id server-side or checked admin rights.
 */

/**
 * Atomically takes an open slot. The conditions are in the UPDATE's WHERE
 * clause, so two people submitting for the same slot at once can't both win:
 * Postgres re-checks the row after the first update commits.
 */
export async function reserveOneOnOneSlot(batchId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("batches")
    .update({ held_slots: 1, availability_status: "full" })
    .eq("id", batchId)
    .eq("is_one_on_one", true)
    .eq("is_active", true)
    .eq("total_slots", 1)
    .eq("held_slots", 0)
    .eq("filled_slots", 0)
    .in("availability_status", ["available", "almost_full"])
    .select("id");

  if (error) {
    console.error("[One-on-one] Failed to reserve slot:", error);
    return false;
  }
  return (data?.length ?? 0) === 1;
}

/**
 * True when this email already holds a one-on-one slot that hasn't been paid
 * for yet. Enrollments aren't readable by the public role, so this runs with
 * the service-role client.
 */
export async function hasOpenOneOnOneReservation(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: pending, error } = await admin
    .from("enrollments")
    .select("batch_id")
    .eq("email", email)
    .eq("payment_status", "PENDING")
    .neq("status", "NOT_INTERESTED")
    .not("batch_id", "is", null);
  if (error) return false;

  const ids = [...new Set((pending ?? []).map((e) => e.batch_id).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return false;

  const { data: slots } = await admin.from("batches").select("id").in("id", ids).eq("is_one_on_one", true).gt("held_slots", 0);
  return (slots?.length ?? 0) > 0;
}

/** Gives a just-reserved slot back, used when the enrollment couldn't be saved after the slot was taken. */
export async function releaseReservedSlot(batchId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("batches")
    .update({ held_slots: 0, availability_status: "available" })
    .eq("id", batchId)
    .eq("is_one_on_one", true)
    .eq("held_slots", 1)
    .eq("filled_slots", 0);
  if (error) console.error("[One-on-one] Failed to release slot:", error);
}

/** Payment confirmed: the reservation becomes a real seat. A no-op for anything that isn't a held one-on-one slot, so it is safe to call on every confirmation. */
export async function markSlotTaken(batchId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("batches")
    .update({ held_slots: 0, filled_slots: 1 })
    .eq("id", batchId)
    .eq("is_one_on_one", true)
    .eq("held_slots", 1);
  if (error) console.error("[One-on-one] Failed to mark slot taken:", error);
}

/** Admin action: clears the slot so the next person can reserve it. */
export async function reopenSlot(batchId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("batches")
    .update({ held_slots: 0, filled_slots: 0, availability_status: "available" })
    .eq("id", batchId)
    .eq("is_one_on_one", true)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Slot not found." };
  return { ok: true };
}
