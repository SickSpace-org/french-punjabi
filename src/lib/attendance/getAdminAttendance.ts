import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { scheduledDatesInWindow } from "./schedule";

export type AttendanceBatchGroup = {
  batchId: string;
  label: string;
  meetingLink: string | null;
  classDays: number[];
  /** Scheduled class dates (today or earlier) in the rolling window, ascending. */
  classDates: string[];
  students: {
    studentId: string;
    fullName: string;
    /** Subset of classDates this student has an attendance row for. */
    presentDates: string[];
  }[];
};

/**
 * One group per batch — its meeting link/schedule (for the admin to
 * edit) plus every currently-assigned ACTIVE student's presence over the
 * rolling window. "Current batch" is the same concept getAdminStudents
 * uses for the course-edit dropdown: a student's most recently confirmed
 * enrollment that has a batch_id. Batches with nobody currently assigned
 * still appear (with an empty student list) so the admin can configure
 * their meeting link/schedule ahead of the first student landing there.
 */
export async function getAdminAttendance(supabase: SupabaseClient<Database>): Promise<AttendanceBatchGroup[]> {
  const [courseData, studentsResult, enrollmentsResult] = await Promise.all([
    getAdminCourseData(supabase),
    supabase.from("students").select("id, full_name").eq("status", "ACTIVE"),
    supabase
      .from("enrollments")
      .select("student_id, batch_id, created_at")
      .not("student_id", "is", null)
      .not("batch_id", "is", null)
      .order("created_at", { ascending: true }),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (enrollmentsResult.error) throw enrollmentsResult.error;

  const nameByStudent = new Map((studentsResult.data ?? []).map((s) => [s.id, s.full_name]));

  // Ascending order means the last write per student is always their most
  // recently confirmed enrollment — same trick getAdminStudents uses.
  const currentBatchByStudent = new Map<string, string>();
  for (const e of enrollmentsResult.data ?? []) {
    if (!e.student_id || !e.batch_id) continue;
    currentBatchByStudent.set(e.student_id, e.batch_id);
  }

  const batchInfo = new Map<string, { label: string; meetingLink: string | null; classDays: number[] }>();
  for (const phase of courseData.phases) {
    for (const batch of phase.batches) {
      batchInfo.set(batch.id, {
        label: `${phase.title} — ${batch.time_label}`,
        meetingLink: batch.meeting_link,
        classDays: batch.class_days,
      });
    }
    for (const level of phase.levels) {
      for (const batch of level.batches) {
        batchInfo.set(batch.id, {
          label: `${phase.title} — ${level.name} — ${batch.time_label}`,
          meetingLink: batch.meeting_link,
          classDays: batch.class_days,
        });
      }
    }
  }

  const studentsByBatch = new Map<string, { studentId: string; fullName: string }[]>();
  for (const [studentId, batchId] of currentBatchByStudent) {
    const fullName = nameByStudent.get(studentId);
    if (!fullName) continue; // not currently an ACTIVE student
    const list = studentsByBatch.get(batchId) ?? [];
    list.push({ studentId, fullName });
    studentsByBatch.set(batchId, list);
  }

  const studentIds = Array.from(nameByStudent.keys());
  const { data: attendanceRows, error: attendanceError } =
    studentIds.length > 0
      ? await supabase.from("attendance").select("student_id, batch_id, class_date").in("student_id", studentIds)
      : { data: [] as { student_id: string; batch_id: string; class_date: string }[], error: null };

  if (attendanceError) throw attendanceError;

  const presentByStudentBatch = new Map<string, Set<string>>();
  for (const row of attendanceRows ?? []) {
    const key = `${row.student_id}|${row.batch_id}`;
    const set = presentByStudentBatch.get(key) ?? new Set<string>();
    set.add(row.class_date);
    presentByStudentBatch.set(key, set);
  }

  const groups: AttendanceBatchGroup[] = [];
  for (const [batchId, info] of batchInfo) {
    const classDates = scheduledDatesInWindow(info.classDays);
    const students = (studentsByBatch.get(batchId) ?? [])
      .map((s) => ({
        studentId: s.studentId,
        fullName: s.fullName,
        presentDates: Array.from(presentByStudentBatch.get(`${s.studentId}|${batchId}`) ?? []),
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    groups.push({ batchId, label: info.label, meetingLink: info.meetingLink, classDays: info.classDays, classDates, students });
  }

  groups.sort((a, b) => b.students.length - a.students.length || a.label.localeCompare(b.label));
  return groups;
}
