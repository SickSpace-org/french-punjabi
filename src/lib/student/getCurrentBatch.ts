import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { buildCourseNameMaps, resolveCourseName } from "@/lib/courses/resolveCourseNames";

export type CurrentBatchInfo = {
  batchId: string;
  /** e.g. "Foundation — Level 1" — live-resolved against the current phase/level names (falls back to the enrollment's frozen text if either was since deleted), same as the admin side's currentCourseLabel. */
  courseName: string;
  meetingLink: string | null;
  classDays: number[];
  /** Exact local class start time ("HH:MM:SS"), or null if the admin hasn't set it — the ±30min check-in window is centered on this. */
  classTime: string | null;
  timeLabel: string;
  timezone: string;
};

/**
 * Same "current batch" concept the admin side uses (getAdminStudents'
 * current_batch_id, getAdminAttendance's grouping) — the batch on this
 * student's most recently confirmed enrollment that actually has a
 * batch_id set (a program-offer enrollment has none). Null if they have no
 * batch-based enrollment yet, or the batch itself is gone.
 */
export async function getCurrentBatch(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<CurrentBatchInfo | null> {
  const [{ data: enrollment }, courseData] = await Promise.all([
    supabase
      .from("enrollments")
      .select("batch_id, phase_id, level_id, phase_name, level_name, program_offer_key")
      .eq("student_id", studentId)
      .not("batch_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Service-role, not the student's own RLS-scoped client — a phase/level
    // that's merely deactivated (not deleted) must still resolve to its
    // live name here, same as it does on the admin side, rather than
    // falling through to the "(removed)" frozen-text fallback just because
    // RLS would hide an inactive row from a non-admin session.
    getAdminCourseData(createAdminClient()),
  ]);

  if (!enrollment?.batch_id) return null;

  const { data: batch } = await supabase
    .from("batches")
    .select("id, meeting_link, class_days, class_time, time_label, timezone")
    .eq("id", enrollment.batch_id)
    .maybeSingle();

  if (!batch) return null;

  const { phaseTitleById, levelNameById } = buildCourseNameMaps(courseData.phases);
  const hasProgramOffer = enrollment.program_offer_key != null;
  const resolvedPhase =
    resolveCourseName(enrollment.phase_id, enrollment.phase_name, phaseTitleById, hasProgramOffer) ??
    enrollment.phase_name;
  const resolvedLevel = resolveCourseName(enrollment.level_id, enrollment.level_name, levelNameById, hasProgramOffer);

  return {
    batchId: batch.id,
    courseName: resolvedLevel ? `${resolvedPhase} — ${resolvedLevel}` : resolvedPhase,
    meetingLink: batch.meeting_link,
    classDays: batch.class_days,
    classTime: batch.class_time,
    timeLabel: batch.time_label,
    timezone: batch.timezone,
  };
}
