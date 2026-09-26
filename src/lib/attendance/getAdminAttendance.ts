import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";

export type AttendanceBatchGroup = {
  batchId: string;
  label: string;
  meetingLink: string | null;
  classDays: number[];
  classTime: string | null;
  /**
   * Roster context for the meeting-link/schedule form below — just who's
   * currently assigned, not attendance data (see the Students page for a
   * student's own history). Ascending by name.
   */
  assignedStudents: { studentId: string; fullName: string }[];
};

/**
 * One group per batch — its meeting link/schedule (for the admin to edit)
 * plus the roster of ACTIVE students currently assigned to it. "Current
 * batch" is the same concept getAdminStudents uses for the course-edit
 * dropdown: a student's most recently confirmed enrollment that has a
 * batch_id. Batches with nobody currently assigned still appear (empty
 * roster) so the admin can configure their meeting link/schedule ahead of
 * the first student landing there.
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

  const batchInfo = new Map<
    string,
    { label: string; meetingLink: string | null; classDays: number[]; classTime: string | null }
  >();
  for (const phase of courseData.phases) {
    for (const batch of phase.batches) {
      batchInfo.set(batch.id, {
        label: `${phase.title} — ${batch.time_label}`,
        meetingLink: batch.meeting_link,
        classDays: batch.class_days,
        classTime: batch.class_time,
      });
    }
    for (const level of phase.levels) {
      for (const batch of level.batches) {
        batchInfo.set(batch.id, {
          label: `${phase.title} — ${level.name} — ${batch.time_label}`,
          meetingLink: batch.meeting_link,
          classDays: batch.class_days,
          classTime: batch.class_time,
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

  const groups: AttendanceBatchGroup[] = [];
  for (const [batchId, info] of batchInfo) {
    const assignedStudents = (studentsByBatch.get(batchId) ?? []).sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );
    groups.push({
      batchId,
      label: info.label,
      meetingLink: info.meetingLink,
      classDays: info.classDays,
      classTime: info.classTime,
      assignedStudents,
    });
  }

  groups.sort((a, b) => b.assignedStudents.length - a.assignedStudents.length || a.label.localeCompare(b.label));
  return groups;
}
