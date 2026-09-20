import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { buildCourseNameMaps, resolveCourseName } from "@/lib/courses/resolveCourseNames";
import { formatCourseLabel } from "@/lib/courses/batchLabel";
import { scheduledDatesInWindow, ATTENDANCE_WINDOW_DAYS } from "@/lib/attendance/schedule";

export type StudentAttendanceSummary = {
  /** The batch this attendance is for — needed to toggle a date via setAttendanceStatus. */
  batchId: string;
  /** True once the assigned batch has at least one class day configured — false means nothing to compute yet. */
  hasSchedule: boolean;
  /** Every scheduled class date in the rolling window (see ATTENDANCE_WINDOW_DAYS), ascending. */
  classDates: string[];
  /** Subset of classDates this student has an attendance row for. */
  presentDates: string[];
  presentCount: number;
  absentCount: number;
  totalCount: number;
};

export type StudentDetail = StudentRow & {
  portalPassword: string | null;
  portalAccessLink: string | null;
  /** Live current course name, e.g. "Foundation — Level 1 — 9:00 PM EST" — resolved the same way as the Students list (see resolveCourseNames.ts). Null if this student has no confirmed enrollment. */
  currentCourseLabel: string | null;
  /** Null when the student has no current batch assignment at all (e.g. a program-offer enrollment with no fixed batch). */
  attendance: StudentAttendanceSummary | null;
  /** Every past batch/level change for this student (Swap Batches or a manual reassignment), newest first — see 028_batch_change_history.sql. Empty if they've never been moved. */
  batchHistory: BatchHistoryEntry[];
};

export type BatchHistoryEntry = {
  fromLabel: string;
  toLabel: string;
  changedAt: string;
};

export async function getStudentDetail(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<StudentDetail | null> {
  const [studentResult, credentialResult, accessResult, historyResult] = await Promise.all([
    supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
    supabase
      .from("student_portal_credentials")
      .select("password")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_portal_access")
      .select("access_token")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("batch_change_history")
      .select("from_label, to_label, changed_at")
      .eq("student_id", studentId)
      .order("changed_at", { ascending: false }),
  ]);

  if (studentResult.error) throw studentResult.error;
  if (!studentResult.data) return null;

  const batchHistory: BatchHistoryEntry[] = (historyResult.data ?? []).map((row) => ({
    fromLabel: row.from_label,
    toLabel: row.to_label,
    changedAt: row.changed_at,
  }));

  const [{ data: enrollment, error: enrollmentError }, courseData] = await Promise.all([
    supabase
      .from("enrollments")
      .select("phase_id, level_id, batch_id, program_offer_key, phase_name, level_name, batch_timing")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getAdminCourseData(supabase),
  ]);

  if (enrollmentError) throw enrollmentError;

  let currentCourseLabel: string | null = null;
  let attendance: StudentAttendanceSummary | null = null;

  if (enrollment) {
    const { phaseTitleById, levelNameById, batchTimingById } = buildCourseNameMaps(courseData.phases);
    const hasProgramOffer = enrollment.program_offer_key != null;
    const resolvedPhase =
      resolveCourseName(enrollment.phase_id, enrollment.phase_name, phaseTitleById, hasProgramOffer) ??
      enrollment.phase_name;
    const resolvedLevel = resolveCourseName(enrollment.level_id, enrollment.level_name, levelNameById, hasProgramOffer);
    const resolvedBatch = resolveCourseName(enrollment.batch_id, enrollment.batch_timing, batchTimingById, hasProgramOffer);

    currentCourseLabel = formatCourseLabel(resolvedPhase, resolvedLevel, resolvedBatch);

    if (enrollment.batch_id) {
      // Find the live batch (for its class_days) — it may no longer exist if deleted.
      let classDays: number[] | null = null;
      for (const phase of courseData.phases) {
        const direct = phase.batches.find((b) => b.id === enrollment.batch_id);
        if (direct) {
          classDays = direct.class_days;
          break;
        }
        const nested = phase.levels.flatMap((l) => l.batches).find((b) => b.id === enrollment.batch_id);
        if (nested) {
          classDays = nested.class_days;
          break;
        }
      }

      const { data: attendanceRows, error: attendanceError } = await supabase
        .from("attendance")
        .select("class_date")
        .eq("student_id", studentId)
        .eq("batch_id", enrollment.batch_id);

      if (attendanceError) throw attendanceError;

      const presentDates = (attendanceRows ?? []).map((r) => r.class_date).sort();

      if (classDays && classDays.length > 0) {
        const classDates = scheduledDatesInWindow(classDays, ATTENDANCE_WINDOW_DAYS);
        const presentSet = new Set(presentDates);
        const presentInWindow = classDates.filter((d) => presentSet.has(d));
        attendance = {
          batchId: enrollment.batch_id,
          hasSchedule: true,
          classDates,
          presentDates: presentInWindow,
          presentCount: presentInWindow.length,
          absentCount: classDates.length - presentInWindow.length,
          totalCount: classDates.length,
        };
      } else {
        // Batch has no schedule configured yet (or was deleted) — we still
        // know how many classes this student has actually attended, ever.
        attendance = {
          batchId: enrollment.batch_id,
          hasSchedule: false,
          classDates: [],
          presentDates,
          presentCount: presentDates.length,
          absentCount: 0,
          totalCount: presentDates.length,
        };
      }
    }
  }

  const accessToken = accessResult.data?.access_token;

  return {
    ...studentResult.data,
    portalPassword: credentialResult.data?.password ?? null,
    portalAccessLink: accessToken
      ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/student/access/${accessToken}`
      : null,
    currentCourseLabel,
    attendance,
    batchHistory,
  };
}
