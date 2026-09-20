import type { AdminPhase } from "./getAdminCourseData";
import { formatBatchTiming } from "./batchLabel";

export type CourseNameMaps = {
  phaseTitleById: Map<string, string>;
  levelNameById: Map<string, string>;
  batchTimingById: Map<string, string>;
};

/**
 * Live id -> current display name lookups, built from the same course tree
 * Courses/Attendance/Content already read from. Used to make Enrollments and
 * Students show the CURRENT phase/level/batch name (so renaming a course in
 * Courses is reflected everywhere), while still falling back to the
 * historical text snapshot on enrollments/students when the row is deleted
 * (see resolveCourseName below) — deleted courses never reappear in any
 * selectable list, but a paying student's record still shows what they
 * originally signed up for.
 */
export function buildCourseNameMaps(phases: AdminPhase[]): CourseNameMaps {
  const phaseTitleById = new Map<string, string>();
  const levelNameById = new Map<string, string>();
  const batchTimingById = new Map<string, string>();

  for (const phase of phases) {
    phaseTitleById.set(phase.id, phase.title);
    for (const level of phase.levels) {
      levelNameById.set(level.id, level.name);
      for (const batch of level.batches) {
        batchTimingById.set(batch.id, formatBatchTiming(batch));
      }
    }
    for (const batch of phase.batches) {
      batchTimingById.set(batch.id, formatBatchTiming(batch));
    }
  }

  return { phaseTitleById, levelNameById, batchTimingById };
}

/** Suffix used on a deleted batch's frozen name — distinct wording from phase/level so it's obvious this specific student needs manually reassigning to a current batch (see isOrphanedBatch below). */
export const OLD_BATCH_SUFFIX = "(Old Batch)";

/** Synthetic Batch-filter value (Students/Inactive Students pages) that matches any student whose assigned batch has been deleted from Courses, so the admin can find and reassign them in one place instead of scrolling the whole list. */
export const OLD_BATCH_FILTER_VALUE = "⚠ Old / Deleted Batch — needs reassigning";

/**
 * `id` is the enrollment/student's stored phase_id/level_id/batch_id (null
 * once that row is deleted from Courses). `storedName` is the frozen text
 * snapshot taken at submission time. `hasProgramOffer` marks rows that were
 * never tied to a phase/level/batch at all (Complete Program / Redo a
 * Month) — those keep their stored label as-is, it was never a live course
 * to begin with. `removedSuffix` lets callers use wording appropriate to
 * what was deleted (see OLD_BATCH_SUFFIX for batches).
 */
export function resolveCourseName(
  id: string | null,
  storedName: string | null,
  liveNameById: Map<string, string>,
  hasProgramOffer: boolean,
  removedSuffix = "(removed)"
): string | null {
  if (id) {
    const live = liveNameById.get(id);
    if (live) return live;
  }
  if (storedName == null) return null;
  if (hasProgramOffer) return storedName;
  return `${storedName} ${removedSuffix}`;
}

/** True when a student/enrollment's batch_id points at a batch that's been deleted from Courses — used to surface an "Old Batch" filter so the admin can find and reassign these easily. */
export function isOrphanedBatch(
  batchId: string | null,
  batchTimingById: Map<string, string>,
  hasProgramOffer: boolean
): boolean {
  return !!batchId && !hasProgramOffer && !batchTimingById.has(batchId);
}
