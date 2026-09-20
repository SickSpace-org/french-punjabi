import { createClient } from "@/lib/supabase/server";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { getAdminStudents } from "@/lib/courses/getAdminStudents";
import SwapBatchesClient, { type SwapRow } from "@/components/admin/swapBatches/SwapBatchesClient";

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

  const rows: SwapRow[] = [];
  for (const phase of courseData.phases) {
    // Batches sitting directly under the phase (no Level layer) — can swap
    // into any of this phase's levels, if it has any.
    // Always offer "stay phase-direct" as a target too — the only option at
    // all for a batch-style phase with no Levels (e.g. Exam Mastery, see
    // 002_seed_data.sql), where a Levels-only target list would leave Swap
    // permanently disabled.
    const allLevelOptions: { id: string | null; name: string }[] = [
      ...phase.levels.map((l) => ({ id: l.id as string | null, name: l.name })),
      { id: null, name: "No Level (stay directly under this Phase)" },
    ];
    for (const batch of phase.batches) {
      if (!batch.is_active) continue;
      rows.push({
        batch,
        phaseTitle: phase.title,
        levelName: null,
        studentCount: countByBatch.get(batch.id) ?? 0,
        levelOptions: allLevelOptions,
        defaultTargetLevelId: phase.levels[0]?.id ?? null,
      });
    }

    phase.levels.forEach((level, index) => {
      const levelOptions = phase.levels
        .filter((l) => l.id !== level.id)
        .map((l) => ({ id: l.id, name: l.name }));
      const nextLevel = phase.levels[index + 1] ?? null;

      for (const batch of level.batches) {
        if (!batch.is_active) continue;
        rows.push({
          batch,
          phaseTitle: phase.title,
          levelName: level.name,
          studentCount: countByBatch.get(batch.id) ?? 0,
          levelOptions,
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
        finished batch onto a new batch under a different Level in one go, instead of reassigning
        them one by one on Students.
      </p>

      <div className="mt-8">
        <SwapBatchesClient rows={rows} />
      </div>
    </div>
  );
}
