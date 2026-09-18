import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";
import { getAdminCourseData } from "./getAdminCourseData";
import { buildCourseNameMaps, resolveCourseName, isOrphanedBatch, OLD_BATCH_SUFFIX } from "./resolveCourseNames";

export type AdminStudentRow = StudentRow & {
  portalPassword: string | null;
  /** Phase(s) from this student's PAID enrollment(s), e.g. "Foundation — Level 1". Null if none found. */
  phase_label: string | null;
  /** This student's most recently confirmed enrollment — what the course-edit dropdown edits. Null if somehow none found. */
  current_enrollment_id: string | null;
  current_batch_id: string | null;
  /**
   * Phase/level/batch of the current enrollment above, resolved to the
   * LIVE name from Courses when it still exists (so a rename there shows up
   * immediately), falling back to the frozen submission-time text — marked
   * "(removed)" — once that phase/level/batch has been deleted. Mirrors
   * getAdminEnrollments' EnrollmentRow overlay.
   */
  current_phase_name: string | null;
  current_level_name: string | null;
  current_batch_label: string | null;
  /** True once the assigned batch has been deleted from Courses — surfaced as an "Old Batch" filter so the admin can find and manually reassign these students. */
  current_batch_orphaned: boolean;
};

/**
 * Students only ever come into existence via confirm_enrollment_payment()
 * (see supabase/005_payments_students.sql / 006_student_accounts.sql) — a
 * row here means an admin has manually verified the Interac e-Transfer for
 * at least one of that person's enrollments. Any ACTIVE student sees every
 * published course automatically (see 010_simplify_access_to_enrolled.sql)
 * — there's no per-student course list to show here.
 *
 * Phase choice itself lives on `enrollments` (not `students` — see 006's
 * comment on why it was moved), since one student account can span several
 * enrollments over time. `enrollments.student_id` is only ever set once
 * payment is confirmed, so no extra payment_status filter is needed here.
 *
 * Also brings in each student's saved portal password (see
 * supabase/011_student_portal_credentials.sql and getStudentDetail.ts,
 * which does the same join for the single-student page) so the list view
 * can show/send it without a click-through per row.
 */
export async function getAdminStudents(supabase: SupabaseClient<Database>): Promise<AdminStudentRow[]> {
  const [studentsResult, credentialsResult, courseData] = await Promise.all([
    supabase.from("students").select("*").order("enrolled_at", { ascending: false }),
    supabase.from("student_portal_credentials").select("student_id, password"),
    getAdminCourseData(supabase),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (credentialsResult.error) throw credentialsResult.error;

  const students = studentsResult.data ?? [];
  const passwordByStudentId = new Map(
    (credentialsResult.data ?? []).map((c) => [c.student_id, c.password])
  );

  if (students.length === 0) return [];

  const { phaseTitleById, levelNameById, batchTimingById } = buildCourseNameMaps(courseData.phases);

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("id, student_id, phase_id, level_id, batch_id, program_offer_key, phase_name, level_name, batch_timing, created_at")
    .in(
      "student_id",
      students.map((s) => s.id)
    )
    .order("created_at", { ascending: true });

  if (enrollmentsError) throw enrollmentsError;

  const phasesByStudent = new Map<string, string[]>();
  // Ascending order means the last write per student below is always their
  // most recently confirmed enrollment — that's the one the "edit course"
  // dropdown in the admin list edits.
  const currentByStudent = new Map<
    string,
    {
      enrollmentId: string;
      batchId: string | null;
      phaseName: string;
      levelName: string | null;
      batchLabel: string | null;
      batchOrphaned: boolean;
    }
  >();
  for (const e of enrollments ?? []) {
    if (!e.student_id) continue;
    const hasProgramOffer = e.program_offer_key != null;
    const resolvedPhase = resolveCourseName(e.phase_id, e.phase_name, phaseTitleById, hasProgramOffer) ?? e.phase_name;
    const resolvedLevel = resolveCourseName(e.level_id, e.level_name, levelNameById, hasProgramOffer);
    const resolvedBatch = resolveCourseName(e.batch_id, e.batch_timing, batchTimingById, hasProgramOffer, OLD_BATCH_SUFFIX);

    const label = resolvedLevel ? `${resolvedPhase} — ${resolvedLevel}` : resolvedPhase;
    const existing = phasesByStudent.get(e.student_id) ?? [];
    if (!existing.includes(label)) existing.push(label);
    phasesByStudent.set(e.student_id, existing);
    currentByStudent.set(e.student_id, {
      enrollmentId: e.id,
      batchId: e.batch_id,
      phaseName: resolvedPhase,
      levelName: resolvedLevel,
      batchLabel: resolvedBatch,
      batchOrphaned: isOrphanedBatch(e.batch_id, batchTimingById, hasProgramOffer),
    });
  }

  return students.map((student) => ({
    ...student,
    portalPassword: passwordByStudentId.get(student.id) ?? null,
    phase_label: phasesByStudent.get(student.id)?.join(", ") ?? null,
    current_enrollment_id: currentByStudent.get(student.id)?.enrollmentId ?? null,
    current_batch_id: currentByStudent.get(student.id)?.batchId ?? null,
    current_phase_name: currentByStudent.get(student.id)?.phaseName ?? null,
    current_level_name: currentByStudent.get(student.id)?.levelName ?? null,
    current_batch_label: currentByStudent.get(student.id)?.batchLabel ?? null,
    current_batch_orphaned: currentByStudent.get(student.id)?.batchOrphaned ?? false,
  }));
}
