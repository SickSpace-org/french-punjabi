import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resolveTeacherBatchLabels } from "./resolveTeacherBatchLabels";
import { ATTENDANCE_WINDOW_DAYS, scheduledDatesInWindow } from "@/lib/attendance/schedule";

export type TeacherAttendanceStudent = {
  studentId: string;
  fullName: string;
  /** Within the rolling window when hasSchedule; lifetime present dates otherwise — same dual-mode rule as StudentAttendanceSummary (getStudentDetail.ts). */
  presentDates: string[];
};

export type TeacherAttendanceBatch = {
  batchId: string;
  label: string;
  meetingLink: string | null;
  classDays: number[];
  classTime: string | null;
  /** False when the batch has no class_days configured yet — mirrors StudentAttendanceSummary.hasSchedule. */
  hasSchedule: boolean;
  /** Scheduled class dates in the rolling window, ascending. Empty when !hasSchedule. */
  classDates: string[];
  students: TeacherAttendanceStudent[];
};

/**
 * A logged-in teacher's own attendance page: their assigned batch(es),
 * each with its roster's per-student attendance history and a manual
 * P/A override (see AttendanceDateGrid, which both this page and the
 * admin Student detail page render through — same setAttendanceStatus
 * action, RLS decides who's allowed).
 *
 * Like getTeacherDashboard.ts, the `batches` query explicitly filters
 * `.eq("teacher_id", teacherId)` rather than relying on RLS alone (see
 * that file's comment for why batches_public_select makes RLS-only
 * scoping insufficient here). The roster + course-label text always comes
 * through teacher_batch_roster() (030) — never a raw enrollments read.
 * `attendance` rows are read directly (attendance_teacher_select, 033) —
 * that table carries no payment/pricing columns, so row-level scoping is
 * sufficient there, same reasoning as admin's own getAdminAttendance.ts.
 */
export async function getTeacherAttendance(
  supabase: SupabaseClient<Database>,
  teacherId: string
): Promise<TeacherAttendanceBatch[]> {
  const { data: batches, error: batchesError } = await supabase
    .from("batches")
    .select("id, phase_id, level_id, name, time_label, timezone, meeting_link, class_days, class_time")
    .eq("teacher_id", teacherId)
    .order("display_order");
  if (batchesError) throw batchesError;
  if (!batches || batches.length === 0) return [];

  const labelByBatchId = await resolveTeacherBatchLabels(supabase, batches);

  const result: TeacherAttendanceBatch[] = [];
  for (const batch of batches) {
    const { data: roster, error: rosterError } = await supabase.rpc("teacher_batch_roster", {
      p_batch_id: batch.id,
    });
    if (rosterError) throw rosterError;

    const studentIds = (roster ?? []).map((r) => r.student_id);
    const { data: attendanceRows, error: attendanceError } =
      studentIds.length > 0
        ? await supabase
            .from("attendance")
            .select("student_id, class_date")
            .eq("batch_id", batch.id)
            .in("student_id", studentIds)
        : { data: [] as { student_id: string; class_date: string }[], error: null };
    if (attendanceError) throw attendanceError;

    const allPresentByStudent = new Map<string, string[]>();
    for (const row of attendanceRows ?? []) {
      const list = allPresentByStudent.get(row.student_id) ?? [];
      list.push(row.class_date);
      allPresentByStudent.set(row.student_id, list);
    }

    const hasSchedule = batch.class_days.length > 0;
    const classDates = hasSchedule ? scheduledDatesInWindow(batch.class_days, ATTENDANCE_WINDOW_DAYS) : [];
    const classDatesSet = new Set(classDates);

    const students = (roster ?? [])
      .map((r) => {
        const allPresent = (allPresentByStudent.get(r.student_id) ?? []).sort();
        return {
          studentId: r.student_id,
          fullName: r.full_name,
          presentDates: hasSchedule ? allPresent.filter((d) => classDatesSet.has(d)) : allPresent,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    result.push({
      batchId: batch.id,
      label: labelByBatchId.get(batch.id) ?? "Course",
      meetingLink: batch.meeting_link,
      classDays: batch.class_days,
      classTime: batch.class_time,
      hasSchedule,
      classDates,
      students,
    });
  }

  return result;
}
