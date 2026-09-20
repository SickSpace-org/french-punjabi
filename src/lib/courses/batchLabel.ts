import type { BatchRow } from "@/types/database";

/**
 * A batch's full display label: its admin-set custom name (e.g. "October
 * Batch"), if any, prefixed onto its time/timezone. Every place that shows a
 * batch's name (Courses' own batch picker, Students, Enrollments, Student
 * detail) must go through this so a name set on a level-nested batch isn't
 * silently dropped like it used to be when only phase-direct batches built
 * this string with the name included.
 */
export function formatBatchTiming(batch: Pick<BatchRow, "name" | "time_label" | "timezone">): string {
  const timeText = batch.timezone ? `${batch.time_label} ${batch.timezone}`.trim() : batch.time_label;
  return batch.name ? `${batch.name} — ${timeText}` : timeText;
}

/**
 * "Foundation — Level 1 — 8:00 PM EST" — the same shape getStudentDetail's
 * currentCourseLabel and batch_change_history's from/to labels use, built
 * from an enrollment's own (possibly live-resolved) phase/level/batch text.
 */
export function formatCourseLabel(
  phaseName: string | null,
  levelName: string | null,
  batchTiming: string | null
): string {
  return [phaseName, levelName, batchTiming].filter(Boolean).join(" — ");
}
