import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

export type AdminStudentRow = StudentRow & {
  portalPassword: string | null;
  /** Phase(s) from this student's PAID enrollment(s), e.g. "Foundation — Level 1". Null if none found. */
  phase_label: string | null;
  /** This student's most recently confirmed enrollment — what the course-edit dropdown edits. Null if somehow none found. */
  current_enrollment_id: string | null;
  current_batch_id: string | null;
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
  const [studentsResult, credentialsResult] = await Promise.all([
    supabase.from("students").select("*").order("enrolled_at", { ascending: false }),
    supabase.from("student_portal_credentials").select("student_id, password"),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (credentialsResult.error) throw credentialsResult.error;

  const students = studentsResult.data ?? [];
  const passwordByStudentId = new Map(
    (credentialsResult.data ?? []).map((c) => [c.student_id, c.password])
  );

  if (students.length === 0) return [];

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("id, student_id, phase_name, level_name, batch_id, created_at")
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
  const currentByStudent = new Map<string, { enrollmentId: string; batchId: string | null }>();
  for (const e of enrollments ?? []) {
    if (!e.student_id) continue;
    const label = e.level_name ? `${e.phase_name} — ${e.level_name}` : e.phase_name;
    const existing = phasesByStudent.get(e.student_id) ?? [];
    if (!existing.includes(label)) existing.push(label);
    phasesByStudent.set(e.student_id, existing);
    currentByStudent.set(e.student_id, { enrollmentId: e.id, batchId: e.batch_id });
  }

  return students.map((student) => ({
    ...student,
    portalPassword: passwordByStudentId.get(student.id) ?? null,
    phase_label: phasesByStudent.get(student.id)?.join(", ") ?? null,
    current_enrollment_id: currentByStudent.get(student.id)?.enrollmentId ?? null,
    current_batch_id: currentByStudent.get(student.id)?.batchId ?? null,
  }));
}
