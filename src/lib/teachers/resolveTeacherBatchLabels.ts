import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatBatchTiming, formatCourseLabel } from "@/lib/courses/batchLabel";

type BatchForLabel = {
  id: string;
  phase_id: string | null;
  level_id: string | null;
  name: string | null;
  time_label: string;
  timezone: string;
};

/**
 * Resolves each batch's live display label (e.g. "Foundation — Level 1 —
 * 9:00 PM EST") by looking up its phase/level names. Shared by
 * getTeacherDashboard.ts and getTeacherAttendance.ts so the label logic —
 * including the graceful fallback when a parent phase/level is itself
 * deactivated (a teacher only sees ACTIVE phases/levels under
 * phases_public_select/levels_public_select) — exists in exactly one
 * place.
 */
export async function resolveTeacherBatchLabels(
  supabase: SupabaseClient<Database>,
  batches: BatchForLabel[]
): Promise<Map<string, string>> {
  const phaseIds = [...new Set(batches.map((b) => b.phase_id).filter((id): id is string => !!id))];
  const levelIds = [...new Set(batches.map((b) => b.level_id).filter((id): id is string => !!id))];

  const [phasesResult, levelsResult] = await Promise.all([
    phaseIds.length > 0
      ? supabase.from("phases").select("id, title").in("id", phaseIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
    levelIds.length > 0
      ? supabase.from("levels").select("id, name, phase_id").in("id", levelIds)
      : Promise.resolve({ data: [] as { id: string; name: string; phase_id: string }[], error: null }),
  ]);
  if (phasesResult.error) throw phasesResult.error;
  if (levelsResult.error) throw levelsResult.error;

  const phaseTitleById = new Map((phasesResult.data ?? []).map((p) => [p.id, p.title]));
  const levelById = new Map((levelsResult.data ?? []).map((l) => [l.id, l]));

  const labelByBatchId = new Map<string, string>();
  for (const batch of batches) {
    let phaseTitle: string | null = null;
    let levelName: string | null = null;
    if (batch.level_id) {
      const level = levelById.get(batch.level_id);
      levelName = level?.name ?? null;
      phaseTitle = level ? (phaseTitleById.get(level.phase_id) ?? null) : null;
    } else if (batch.phase_id) {
      phaseTitle = phaseTitleById.get(batch.phase_id) ?? null;
    }
    labelByBatchId.set(batch.id, formatCourseLabel(phaseTitle ?? "Course", levelName, formatBatchTiming(batch)));
  }

  return labelByBatchId;
}
