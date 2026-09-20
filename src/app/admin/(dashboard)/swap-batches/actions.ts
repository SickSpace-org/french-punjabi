"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatBatchTiming, formatCourseLabel } from "@/lib/courses/batchLabel";
import type { AvailabilityStatus } from "@/types/database";

export type SwapBatchInput = {
  name: string;
  teacherName: string;
  timeLabel: string;
  timezone: string;
  note: string;
  isTbd: boolean;
  availabilityStatus: AvailabilityStatus;
  totalSlots: number | null;
};

export type SwapTarget =
  | { type: "existing"; levelId: string }
  | { type: "none" }
  | { type: "new"; name: string };

export type SwapBatchResult = { ok: true; movedCount: number } | { ok: false; error: string };

/** levels.slug is globally unique (see 001_schema.sql) — kebab-case the name and disambiguate on conflict. */
function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "level";
}

function revalidateSwap() {
  revalidatePath("/admin/swap-batches");
  revalidatePath("/admin/courses");
  revalidatePath("/admin/students");
  revalidatePath("/admin/students/inactive");
  revalidatePath("/admin/enrollments");
  revalidatePath("/courses");
}

/**
 * Moves an entire finished batch's worth of students onto a fresh batch in
 * one shot, instead of the admin reassigning each student one by one on
 * Students (see StudentsTable's per-row updateStudentCourse). Deliberately
 * always creates a NEW batch row rather than re-parenting the old one, so
 * the old batch's attendance history (keyed by batch_id) stays intact and
 * closed-out under its original spot, while the new batch starts clean.
 *
 * `target` is `{ type: "none" }` for a phase that has no Levels at all (e.g.
 * a "batch-style" phase like Exam Mastery, see 002_seed_data.sql) — the new
 * batch then stays phase-direct instead of moving under a Level. `{ type:
 * "new", name }` lets the admin introduce a brand-new Level right from this
 * modal (e.g. "Level 4") instead of having to create it on Courses first.
 */
export async function swapBatch(
  oldBatchId: string,
  target: SwapTarget,
  input: SwapBatchInput
): Promise<SwapBatchResult> {
  const supabase = await createClient();

  const { data: oldBatch, error: oldBatchError } = await supabase
    .from("batches")
    .select("id, phase_id, level_id, meeting_link, class_days, class_time")
    .eq("id", oldBatchId)
    .maybeSingle();
  if (oldBatchError || !oldBatch) return { ok: false, error: "Batch not found." };

  // A batch's current phase is either its own phase_id (a phase-direct
  // batch, no Level layer) or, for a level-nested batch, its level's
  // phase_id — either way it can swap into any Level of that same phase, or
  // stay phase-direct under it.
  let currentPhaseId = oldBatch.phase_id;
  if (!currentPhaseId && oldBatch.level_id) {
    const { data: oldLevel, error: oldLevelError } = await supabase
      .from("levels")
      .select("phase_id")
      .eq("id", oldBatch.level_id)
      .maybeSingle();
    if (oldLevelError || !oldLevel) return { ok: false, error: "Batch's current level not found." };
    currentPhaseId = oldLevel.phase_id;
  }
  if (!currentPhaseId) return { ok: false, error: "This batch has no parent phase — can't swap it." };

  let targetLevel: { id: string; name: string } | null = null;

  if (target.type === "existing") {
    const { data: level, error: levelError } = await supabase
      .from("levels")
      .select("id, name, phase_id")
      .eq("id", target.levelId)
      .maybeSingle();
    if (levelError || !level) return { ok: false, error: "Target level not found." };
    if (level.phase_id !== currentPhaseId) {
      return { ok: false, error: "The target level must be in the same phase." };
    }
    targetLevel = level;
  } else if (target.type === "new") {
    const name = target.name.trim();
    if (!name) return { ok: false, error: "New level name can't be empty." };

    const { data: siblingLevels, error: siblingLevelsError } = await supabase
      .from("levels")
      .select("display_order")
      .eq("phase_id", currentPhaseId);
    if (siblingLevelsError) return { ok: false, error: siblingLevelsError.message };
    const nextLevelOrder = (siblingLevels ?? []).reduce((max, l) => Math.max(max, l.display_order), 0) + 1;

    const baseSlug = slugify(name);
    let insertedLevel: { id: string; name: string } | null = null;
    let lastError: { code?: string; message: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: newLevel, error: newLevelError } = await supabase
        .from("levels")
        .insert({
          phase_id: currentPhaseId,
          slug,
          name,
          subtitle: null,
          teacher_name: null,
          display_order: nextLevelOrder,
          is_active: true,
        })
        .select("id, name")
        .single();
      if (!newLevelError) {
        insertedLevel = newLevel;
        break;
      }
      lastError = newLevelError;
      if (newLevelError.code !== "23505") break; // only retry on a slug collision
    }
    if (!insertedLevel) return { ok: false, error: lastError?.message ?? "Could not create the new level." };
    targetLevel = insertedLevel;
  }
  // target.type === "none" leaves targetLevel as null — stays phase-direct.

  const { data: phase, error: phaseError } = await supabase
    .from("phases")
    .select("title")
    .eq("id", currentPhaseId)
    .maybeSingle();
  if (phaseError || !phase) return { ok: false, error: "Phase not found." };

  const siblingQuery = targetLevel
    ? supabase.from("batches").select("display_order").eq("level_id", targetLevel.id)
    : supabase.from("batches").select("display_order").eq("phase_id", currentPhaseId);
  const { data: siblingBatches, error: siblingError } = await siblingQuery;
  if (siblingError) return { ok: false, error: siblingError.message };
  const nextDisplayOrder =
    (siblingBatches ?? []).reduce((max, b) => Math.max(max, b.display_order), 0) + 1;

  const { data: newBatch, error: insertError } = await supabase
    .from("batches")
    .insert({
      phase_id: targetLevel ? null : currentPhaseId,
      level_id: targetLevel ? targetLevel.id : null,
      name: input.name || null,
      teacher_name: input.teacherName || null,
      time_label: input.timeLabel,
      timezone: input.timezone,
      note: input.note || null,
      is_tbd: input.isTbd,
      availability_status: input.availabilityStatus,
      total_slots: input.totalSlots,
      filled_slots: 0,
      display_order: nextDisplayOrder,
      is_active: true,
      // Carried over as sane defaults from the batch it replaces — the admin
      // can still fine-tune them on the new batch afterwards.
      meeting_link: oldBatch.meeting_link,
      class_days: oldBatch.class_days,
      class_time: oldBatch.class_time,
    })
    .select("id, name, time_label, timezone")
    .single();

  if (insertError || !newBatch) {
    return { ok: false, error: insertError?.message ?? "Could not create the new batch." };
  }

  // Snapshot each moving student's OLD label before it's overwritten below —
  // batch_change_history needs the "from" side, and this is the only chance
  // to read it.
  const { data: enrollmentsToMove, error: toMoveError } = await supabase
    .from("enrollments")
    .select("id, student_id, phase_name, level_name, batch_timing")
    .eq("batch_id", oldBatchId)
    .not("student_id", "is", null);
  if (toMoveError) return { ok: false, error: toMoveError.message };

  const toLabel = formatCourseLabel(phase.title, targetLevel?.name ?? null, formatBatchTiming(newBatch));

  const { data: movedEnrollments, error: moveError } = await supabase
    .from("enrollments")
    .update({
      batch_id: newBatch.id,
      level_id: targetLevel ? targetLevel.id : null,
      level_name: targetLevel?.name ?? null,
      phase_id: currentPhaseId,
      phase_name: phase.title,
      batch_timing: formatBatchTiming(newBatch),
    })
    .eq("batch_id", oldBatchId)
    .not("student_id", "is", null)
    .select("id");

  if (moveError) return { ok: false, error: moveError.message };

  const movedCount = movedEnrollments?.length ?? 0;

  const [{ error: slotsError }, { error: deactivateError }] = await Promise.all([
    supabase.from("batches").update({ filled_slots: movedCount }).eq("id", newBatch.id),
    supabase.from("batches").update({ is_active: false }).eq("id", oldBatchId),
  ]);
  if (slotsError) return { ok: false, error: slotsError.message };
  if (deactivateError) return { ok: false, error: deactivateError.message };

  // Best-effort: history is a record of what happened, not a precondition
  // for the move itself — a missing/not-yet-migrated table here must never
  // undo or block a swap that already succeeded above.
  const historyRows = (enrollmentsToMove ?? [])
    .filter((e): e is typeof e & { student_id: string } => e.student_id != null)
    .map((e) => ({
      student_id: e.student_id,
      enrollment_id: e.id,
      from_label: formatCourseLabel(e.phase_name, e.level_name, e.batch_timing),
      to_label: toLabel,
    }));
  if (historyRows.length > 0) {
    const { error: historyError } = await supabase.from("batch_change_history").insert(historyRows);
    if (historyError) console.error("batch_change_history insert failed:", historyError.message);
  }

  revalidateSwap();
  return { ok: true, movedCount };
}
