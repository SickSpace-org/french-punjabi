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
  | { type: "none"; phaseId: string }
  | { type: "new"; name: string; phaseId: string };

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
 * `target` can point at a Level in ANY phase, not just the batch's current
 * one — an admin can fully move a group of students onto a different Phase
 * altogether (e.g. Foundation → TEF/TCF Preparation), not just a different
 * Level within the same Phase. `{ type: "none", phaseId }` is for a phase
 * that has no Levels at all (e.g. a "batch-style" phase like Exam Mastery,
 * see 002_seed_data.sql) — the new batch then stays phase-direct instead of
 * moving under a Level. `{ type: "new", name, phaseId }` lets the admin
 * introduce a brand-new Level right from this modal (e.g. "Level 4")
 * instead of having to create it on Courses first.
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

  // Only used to confirm the source batch actually belongs to some phase —
  // the target phase is independently resolved below and no longer has to
  // match this.
  let sourcePhaseId = oldBatch.phase_id;
  if (!sourcePhaseId && oldBatch.level_id) {
    const { data: oldLevel, error: oldLevelError } = await supabase
      .from("levels")
      .select("phase_id")
      .eq("id", oldBatch.level_id)
      .maybeSingle();
    if (oldLevelError || !oldLevel) return { ok: false, error: "Batch's current level not found." };
    sourcePhaseId = oldLevel.phase_id;
  }
  if (!sourcePhaseId) return { ok: false, error: "This batch has no parent phase — can't swap it." };

  let targetLevel: { id: string; name: string } | null = null;
  let targetPhaseId: string;

  if (target.type === "existing") {
    const { data: level, error: levelError } = await supabase
      .from("levels")
      .select("id, name, phase_id")
      .eq("id", target.levelId)
      .maybeSingle();
    if (levelError || !level) return { ok: false, error: "Target level not found." };
    targetLevel = level;
    targetPhaseId = level.phase_id;
  } else if (target.type === "new") {
    const name = target.name.trim();
    if (!name) return { ok: false, error: "New level name can't be empty." };
    targetPhaseId = target.phaseId;

    const { data: siblingLevels, error: siblingLevelsError } = await supabase
      .from("levels")
      .select("display_order")
      .eq("phase_id", targetPhaseId);
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
          phase_id: targetPhaseId,
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
  } else {
    targetPhaseId = target.phaseId;
  }
  // target.type === "none" leaves targetLevel as null — stays phase-direct.

  const { data: phase, error: phaseError } = await supabase
    .from("phases")
    .select("title")
    .eq("id", targetPhaseId)
    .maybeSingle();
  if (phaseError || !phase) return { ok: false, error: "Target phase not found." };

  const siblingQuery = targetLevel
    ? supabase.from("batches").select("display_order").eq("level_id", targetLevel.id)
    : supabase.from("batches").select("display_order").eq("phase_id", targetPhaseId);
  const { data: siblingBatches, error: siblingError } = await siblingQuery;
  if (siblingError) return { ok: false, error: siblingError.message };
  const nextDisplayOrder =
    (siblingBatches ?? []).reduce((max, b) => Math.max(max, b.display_order), 0) + 1;

  const { data: newBatch, error: insertError } = await supabase
    .from("batches")
    .insert({
      phase_id: targetLevel ? null : targetPhaseId,
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

  // Candidates: every confirmed enrollment currently sitting on this batch.
  // Snapshotted before the update below overwrites it — batch_change_history
  // needs the "from" side, and this is the only chance to read it.
  const { data: candidates, error: candidatesError } = await supabase
    .from("enrollments")
    .select("id, student_id, phase_name, level_name, batch_timing")
    .eq("batch_id", oldBatchId)
    .not("student_id", "is", null);
  if (candidatesError) return { ok: false, error: candidatesError.message };

  // A student can have more than one confirmed enrollment over time (e.g.
  // they later signed up for a second course) — only their MOST RECENT one
  // is what "current batch" means everywhere else in the admin (see
  // getAdminStudents' current_batch_id), and what the Swap Batches student
  // count is built from. Without this check, swapping an old/finished batch
  // could incorrectly drag along a student whose enrollment row here is
  // actually stale history, not their current course.
  const candidateStudentIds = [...new Set((candidates ?? []).map((c) => c.student_id!))];
  const { data: allTheirEnrollments, error: allEnrollmentsError } =
    candidateStudentIds.length > 0
      ? await supabase
          .from("enrollments")
          .select("id, student_id, created_at")
          .in("student_id", candidateStudentIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };
  if (allEnrollmentsError) return { ok: false, error: allEnrollmentsError.message };

  const currentEnrollmentIdByStudent = new Map<string, string>();
  for (const e of allTheirEnrollments ?? []) {
    if (!e.student_id) continue;
    currentEnrollmentIdByStudent.set(e.student_id, e.id); // ascending order — last write wins
  }

  const enrollmentsToMove = (candidates ?? []).filter(
    (c) => c.student_id && currentEnrollmentIdByStudent.get(c.student_id) === c.id
  );
  const idsToMove = enrollmentsToMove.map((e) => e.id);

  const toLabel = formatCourseLabel(phase.title, targetLevel?.name ?? null, formatBatchTiming(newBatch));

  let movedCount = 0;
  if (idsToMove.length > 0) {
    const { data: movedEnrollments, error: moveError } = await supabase
      .from("enrollments")
      .update({
        batch_id: newBatch.id,
        level_id: targetLevel ? targetLevel.id : null,
        level_name: targetLevel?.name ?? null,
        phase_id: targetPhaseId,
        phase_name: phase.title,
        batch_timing: formatBatchTiming(newBatch),
      })
      .in("id", idsToMove)
      .select("id");

    if (moveError) return { ok: false, error: moveError.message };
    movedCount = movedEnrollments?.length ?? 0;
  }

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
