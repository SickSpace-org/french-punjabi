import { createClient } from "@/lib/supabase/server";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { getAdminStudents } from "@/lib/courses/getAdminStudents";
import SwapBatchesClient, {
  type SwapPhaseOption,
  type SwapRow,
} from "@/components/admin/swapBatches/SwapBatchesClient";

export default async function SwapBatchesPage() {
  const supabase = await createClient();
  const [courseData, students] = await Promise.all([
    getAdminCourseData(supabase),
    getAdminStudents(supabase),
  ]);

  const countByBatch = new Map<string, number>();
  for (const student of students) {
    if (!student.current_batch_id) continue;
    countByBatch.set(student.current_batch_id, (countByBatch.get(student.current_batch_id) ?? 0) + 1);
  }

  // Every active phase, with its active levels — the modal uses this to let
  // the admin retarget a batch into ANY phase, not just the one it's
  // already in, in addition to picking a level within it.
  const allPhases: SwapPhaseOption[] = courseData.phases
    .filter((phase) => phase.is_active)
    .map((phase) => ({
      phaseId: phase.id,
      title: phase.title,
      levels: phase.levels.filter((l) => l.is_active).map((l) => ({ id: l.id, name: l.name })),
    }));

  const rows: SwapRow[] = [];
  for (const phase of courseData.phases) {
    // Skip an inactive phase entirely — it wouldn't appear in allPhases'
    // Target Phase list either, so a batch under one would have no sane
    // "current phase" default to select in the modal.
    if (!phase.is_active) continue;

    const activeLevels = phase.levels.filter((l) => l.is_active);

    for (const batch of phase.batches) {
      if (!batch.is_active) continue;
      rows.push({
        batch,
        phaseId: phase.id,
        phaseTitle: phase.title,
        levelName: null,
        studentCount: countByBatch.get(batch.id) ?? 0,
        defaultTargetLevelId: activeLevels[0]?.id ?? null,
      });
    }

    activeLevels.forEach((level, index) => {
      const nextLevel = activeLevels[index + 1] ?? null;

      for (const batch of level.batches) {
        if (!batch.is_active) continue;
        rows.push({
          batch,
          phaseId: phase.id,
          phaseTitle: phase.title,
          levelName: level.name,
          studentCount: countByBatch.get(batch.id) ?? 0,
          defaultTargetLevelId: nextLevel?.id ?? null,
        });
      }
    });
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Swap Batches</h1>
      <p className="mt-1 text-sm text-navy/60">
        Every batch currently running in Courses, across every Phase. Move every student in a
        finished batch onto a new batch under any Phase/Level in one go, instead of reassigning
        them one by one on Students.
      </p>

      <div className="mt-8">
        <SwapBatchesClient rows={rows} allPhases={allPhases} />
      </div>
    </div>
  );
}
