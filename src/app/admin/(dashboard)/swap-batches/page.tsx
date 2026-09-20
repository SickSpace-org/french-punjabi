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
        Move every student in a finished batch onto a new batch under the next Level in one go,
        instead of reassigning them one by one on Students.
      </p>

      <div className="mt-8">
        <SwapBatchesClient rows={rows} />
      </div>
    </div>
  );
}
