import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { buildCourseNameMaps, resolveCourseName } from "@/lib/courses/resolveCourseNames";
import { formatCourseLabel } from "@/lib/courses/batchLabel";
import { scheduledDatesInWindow, ATTENDANCE_WINDOW_DAYS } from "@/lib/attendance/schedule";

export type StudentAttendanceSummary = {
  /** The batch this attendance is for — needed to toggle a date via setAttendanceStatus. */
  batchId: string;
  /** Resolved display label for this batch, e.g. "Foundation — Level 1 — 9:00 PM EST". */
  batchLabel: string;
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
  /**
   * One entry per distinct batch this student has ever been enrolled in
   * (most recent enrollment first) — a student can hold more than one
   * enrollment row over time (see getAdminStudents.ts), each pinned to its
   * own batch_id with its own attendance history. Empty when the student
   * has no enrollment with a batch assigned at all (e.g. a program-offer
   * enrollment with no fixed batch).
   */
  attendance: StudentAttendanceSummary[];
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

  const [{ data: enrollments, error: enrollmentError }, courseData] = await Promise.all([
    supabase
      .from("enrollments")
      .select("phase_id, level_id, batch_id, program_offer_key, phase_name, level_name, batch_timing, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    getAdminCourseData(supabase),
  ]);

  if (enrollmentError) throw enrollmentError;

  const { phaseTitleById, levelNameById, batchTimingById } = buildCourseNameMaps(courseData.phases);

  let currentCourseLabel: string | null = null;
  const attendance: StudentAttendanceSummary[] = [];

  const mostRecentEnrollment = enrollments?.[0] ?? null;
  if (mostRecentEnrollment) {
    const hasProgramOffer = mostRecentEnrollment.program_offer_key != null;
    const resolvedPhase =
      resolveCourseName(mostRecentEnrollment.phase_id, mostRecentEnrollment.phase_name, phaseTitleById, hasProgramOffer) ??
      mostRecentEnrollment.phase_name;
    const resolvedLevel = resolveCourseName(
      mostRecentEnrollment.level_id,
      mostRecentEnrollment.level_name,
      levelNameById,
      hasProgramOffer
    );
    const resolvedBatch = resolveCourseName(
      mostRecentEnrollment.batch_id,
      mostRecentEnrollment.batch_timing,
      batchTimingById,
      hasProgramOffer
    );
    currentCourseLabel = formatCourseLabel(resolvedPhase, resolvedLevel, resolvedBatch);
  }

  // Distinct batches across every enrollment this student has ever had,
  // most-recent enrollment first — a student can hold more than one
  // enrollment row over time (e.g. re-enrolling after finishing a level; see
  // getAdminStudents.ts), each pinned to its own batch_id with its own
  // attendance history.
  const seenBatchIds = new Set<string>();
  const batchEnrollments: NonNullable<typeof enrollments> = [];
  for (const e of enrollments ?? []) {
    if (!e.batch_id || seenBatchIds.has(e.batch_id)) continue;
    seenBatchIds.add(e.batch_id);
    batchEnrollments.push(e);
  }

  if (batchEnrollments.length > 0) {
    const { data: attendanceRows, error: attendanceError } = await supabase
      .from("attendance")
      .select("batch_id, class_date")
      .eq("student_id", studentId)
      .in(
        "batch_id",
        batchEnrollments.map((e) => e.batch_id as string)
      );

    if (attendanceError) throw attendanceError;

    const presentDatesByBatch = new Map<string, string[]>();
    for (const row of attendanceRows ?? []) {
      const list = presentDatesByBatch.get(row.batch_id) ?? [];
      list.push(row.class_date);
      presentDatesByBatch.set(row.batch_id, list);
    }

    for (const e of batchEnrollments) {
      const batchId = e.batch_id as string;
      const hasProgramOffer = e.program_offer_key != null;
      const resolvedPhase = resolveCourseName(e.phase_id, e.phase_name, phaseTitleById, hasProgramOffer) ?? e.phase_name;
      const resolvedLevel = resolveCourseName(e.level_id, e.level_name, levelNameById, hasProgramOffer);
      const resolvedBatch = resolveCourseName(batchId, e.batch_timing, batchTimingById, hasProgramOffer);
      const batchLabel = formatCourseLabel(resolvedPhase, resolvedLevel, resolvedBatch);

      // Find the live batch (for its class_days) — it may no longer exist if deleted.
      let classDays: number[] | null = null;
      for (const phase of courseData.phases) {
        const direct = phase.batches.find((b) => b.id === batchId);
        if (direct) {
          classDays = direct.class_days;
          break;
        }
        const nested = phase.levels.flatMap((l) => l.batches).find((b) => b.id === batchId);
        if (nested) {
          classDays = nested.class_days;
          break;
        }
      }

      const presentDates = (presentDatesByBatch.get(batchId) ?? []).sort();

      // The rolling "scheduled dates in the last N days" grid only makes
      // sense for the student's CURRENT batch — a past batch's class_days
      // describes whoever is in it *now*, not this student, so applying the
      // same rolling window to an old enrollment would invent recent
      // "scheduled" dates the student was never actually expected at and
      // show them as Absent. Older batches always get the simple lifetime
      // list instead, regardless of whether class_days happens to be set.
      const isCurrentBatch = batchId === mostRecentEnrollment?.batch_id;

      if (isCurrentBatch && classDays && classDays.length > 0) {
        const classDates = scheduledDatesInWindow(classDays, ATTENDANCE_WINDOW_DAYS);
        const presentSet = new Set(presentDates);
        const presentInWindow = classDates.filter((d) => presentSet.has(d));
        attendance.push({
          batchId,
          batchLabel,
          hasSchedule: true,
          classDates,
          presentDates: presentInWindow,
          presentCount: presentInWindow.length,
          absentCount: classDates.length - presentInWindow.length,
          totalCount: classDates.length,
        });
      } else {
        // Not the current batch, or it has no schedule configured (or was
        // deleted) — we still know how many classes this student has
        // actually attended against it, ever.
        attendance.push({
          batchId,
          batchLabel,
          hasSchedule: false,
          classDates: [],
          presentDates,
          presentCount: presentDates.length,
          absentCount: 0,
          totalCount: presentDates.length,
        });
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
