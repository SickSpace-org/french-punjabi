"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { generateSlots } from "@/lib/oneOnOne/slotTimes";
import { reopenSlot } from "@/lib/oneOnOne/slots";
import { notifyOneOnOnePhase } from "@/lib/oneOnOne/notifyPhase";
import { DEFAULT_TEACHER_NAME } from "@/data/personalisedOneOnOne";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/admin/one-on-one");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/enrollments");
  revalidatePath("/courses", "layout");
}

export type AddSlotsInput = {
  phaseId: string;
  /** 24-hour "HH:MM" from <input type="time">. */
  start: string;
  end: string;
  timezone: string;
  teacherId: string | null;
  classDays: number[];
  meetingLink: string;
};

/**
 * Opens a run of back-to-back 30-minute slots under one phase, then emails
 * everyone who asked to be told when that phase's next one-on-one batch opens.
 * Slots that already exist at the same time are skipped, so re-running the
 * same range is harmless.
 */
export async function addOneOnOneSlots(input: AddSlotsInput): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };

  const generated = generateSlots(input.start, input.end);
  if (!generated) return { ok: false, error: "Pick a start and end time at least 30 minutes apart." };
  const timezone = input.timezone.trim() || "EST";
  const classDays = [...new Set(input.classDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();

  const supabase = await createClient();

  let teacherName = DEFAULT_TEACHER_NAME;
  if (input.teacherId) {
    const { data: teacher } = await supabase.from("teachers").select("full_name").eq("id", input.teacherId).maybeSingle();
    if (!teacher) return { ok: false, error: "That teacher no longer exists." };
    teacherName = teacher.full_name;
  }

  const { data: existing, error: existingError } = await supabase
    .from("batches")
    .select("time_label, timezone, display_order")
    .eq("phase_id", input.phaseId)
    .eq("is_one_on_one", true);
  if (existingError) return { ok: false, error: existingError.message };

  const taken = new Set((existing ?? []).map((b) => `${b.time_label}|${b.timezone}`));
  let nextOrder = (existing ?? []).reduce((max, b) => Math.max(max, b.display_order), 0) + 1;

  const rows = generated
    .filter((slot) => !taken.has(`${slot.label}|${timezone}`))
    .map((slot) => ({
      phase_id: input.phaseId,
      level_id: null,
      name: "One-on-one",
      teacher_name: teacherName,
      teacher_id: input.teacherId,
      time_label: slot.label,
      timezone,
      note: null,
      is_tbd: false,
      availability_status: "available" as const,
      total_slots: 1,
      filled_slots: 0,
      held_slots: 0,
      is_one_on_one: true,
      display_order: nextOrder++,
      is_active: true,
      class_time: slot.classTime,
      class_days: classDays,
      meeting_link: input.meetingLink.trim() || null,
    }));

  if (rows.length === 0) return { ok: false, error: "Those slots already exist for this phase." };

  const { error } = await supabase.from("batches").insert(rows);
  if (error) return { ok: false, error: error.message };

  const notified = await notifyOneOnOnePhase(supabase, input.phaseId);
  revalidateAll();

  const skipped = generated.length - rows.length;
  return {
    ok: true,
    message:
      `Opened ${rows.length} slot${rows.length === 1 ? "" : "s"}` +
      (skipped ? ` (${skipped} already existed)` : "") +
      (notified ? `, and emailed ${notified} ${notified === 1 ? "person" : "people"} who were waiting.` : "."),
  };
}

/**
 * Puts a reserved or taken slot back to open, for example when a student
 * quits. A reservation that was never paid is marked "not interested" so it
 * stops looking live in Enrollments. An already-confirmed student's portal
 * access is NOT changed here; deactivate them from Students if they've left.
 * Anyone waiting for this phase is emailed that a slot is open again.
 */
export async function reopenOneOnOneSlot(batchId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batches")
    .select("phase_id, is_one_on_one")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch?.is_one_on_one) return { ok: false, error: "Slot not found." };

  const reopened = await reopenSlot(batchId);
  if (!reopened.ok) return reopened;

  const { error: releaseError } = await supabase
    .from("enrollments")
    .update({ status: "NOT_INTERESTED" })
    .eq("batch_id", batchId)
    .eq("payment_status", "PENDING")
    .in("status", ["NEW", "CONTACTED"]);
  if (releaseError) console.error("[One-on-one] Failed to release unpaid enrollment:", releaseError);

  const notified = batch.phase_id ? await notifyOneOnOnePhase(supabase, batch.phase_id) : 0;
  revalidateAll();
  return {
    ok: true,
    message: notified ? `Slot reopened, and ${notified} waiting ${notified === 1 ? "person was" : "people were"} emailed.` : "Slot reopened.",
  };
}

/** Hides an unused slot from the public pages (or shows it again). Reserved and taken slots can't be hidden. */
export async function setOneOnOneSlotVisible(batchId: string, visible: boolean): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batches")
    .select("is_one_on_one, held_slots, filled_slots")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch?.is_one_on_one) return { ok: false, error: "Slot not found." };
  if (!visible && (batch.held_slots > 0 || batch.filled_slots > 0)) {
    return { ok: false, error: "This slot is in use. Reopen it first." };
  }

  const { error } = await supabase.from("batches").update({ is_active: visible }).eq("id", batchId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/**
 * Permanently deletes one unused slot (for example the 1:30 PM to 2:00 PM one).
 * Only slots nobody has ever reserved can be deleted: removing a batch also
 * removes its attendance, recordings and materials, so anything with enrollment
 * history must be hidden instead.
 */
export async function deleteOneOnOneSlot(batchId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batches")
    .select("is_one_on_one, held_slots, filled_slots")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch?.is_one_on_one) return { ok: false, error: "Slot not found." };
  if (batch.held_slots > 0 || batch.filled_slots > 0) {
    return { ok: false, error: "This slot is in use. Reopen it first, then hide it instead of deleting." };
  }

  const { count, error: historyError } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  if (historyError) return { ok: false, error: historyError.message };
  if (count) {
    return { ok: false, error: "Someone has enrolled in this slot before, so it can't be deleted. Use Hide instead." };
  }

  const { error } = await supabase.from("batches").delete().eq("id", batchId);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, message: "Slot deleted." };
}

/** Emails everyone waiting on a phase, even if no new slot was just added. With `again`, also those already told. */
export async function emailOneOnOneWaiting(phaseId: string, again = false): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const sent = await notifyOneOnOnePhase(supabase, phaseId, { includeNotified: again });
  revalidatePath("/admin/one-on-one");
  if (sent === 0) return { ok: false, error: "No emails were sent. Check the email settings and try again." };
  return { ok: true, message: `Emailed ${sent} ${sent === 1 ? "person" : "people"}.` };
}

export async function removeOneOnOneWaiting(entryId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error, count } = await supabase.from("one_on_one_notify").delete({ count: "exact" }).eq("id", entryId);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Couldn't remove this entry." };
  revalidatePath("/admin/one-on-one");
  return { ok: true };
}
