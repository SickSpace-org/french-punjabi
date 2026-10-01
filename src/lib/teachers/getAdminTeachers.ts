import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TeacherRow } from "@/types/database";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { formatBatchTiming, formatCourseLabel } from "@/lib/courses/batchLabel";

/** Minimal shape for a "which teacher" picker (batch assignment) — never carries email/status, just enough to label an option. */
export type TeacherOption = { id: string; full_name: string };

export type AdminTeacherRow = TeacherRow & {
  /** This teacher's assigned batch(es), resolved to a live display label — e.g. "Foundation — Level 1 — 9:00 PM EST". Empty if none assigned yet. */
  assignedBatches: { batchId: string; label: string }[];
};

/**
 * Every teacher plus which batch(es) — if any — an admin has assigned them
 * to (see batches.teacher_id, supabase/029_teachers.sql). One teacher can
 * be assigned to more than one batch even though a batch has at most one
 * teacher.
 */
export async function getAdminTeachers(supabase: SupabaseClient<Database>): Promise<AdminTeacherRow[]> {
  const [teachersResult, courseData] = await Promise.all([
    supabase.from("teachers").select("*").order("created_at", { ascending: false }),
    getAdminCourseData(supabase),
  ]);

  if (teachersResult.error) throw teachersResult.error;

  const batchesByTeacher = new Map<string, { batchId: string; label: string }[]>();
  const addBatch = (teacherId: string | null, batchId: string, label: string) => {
    if (!teacherId) return;
    const list = batchesByTeacher.get(teacherId) ?? [];
    list.push({ batchId, label });
    batchesByTeacher.set(teacherId, list);
  };

  for (const phase of courseData.phases) {
    for (const batch of phase.batches) {
      addBatch(batch.teacher_id, batch.id, `${phase.title} — ${formatBatchTiming(batch)}`);
    }
    for (const level of phase.levels) {
      for (const batch of level.batches) {
        addBatch(batch.teacher_id, batch.id, formatCourseLabel(phase.title, level.name, formatBatchTiming(batch)));
      }
    }
  }

  return (teachersResult.data ?? []).map((teacher) => ({
    ...teacher,
    assignedBatches: batchesByTeacher.get(teacher.id) ?? [],
  }));
}
