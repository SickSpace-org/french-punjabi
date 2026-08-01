import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

export type StudentWithPhase = StudentRow & {
  /** Phase(s) from this student's PAID enrollment(s), e.g. "Foundation — Level 1". Null if none found. */
  phase_label: string | null;
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
 */
export async function getAdminStudents(supabase: SupabaseClient<Database>): Promise<StudentWithPhase[]> {
  const { data: students, error } = await supabase
    .from("students")
    .select("*")
    .order("enrolled_at", { ascending: false });

  if (error) throw error;
  if (!students || students.length === 0) return [];

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("enrollments")
    .select("student_id, phase_name, level_name")
    .in(
      "student_id",
      students.map((s) => s.id)
    )
    .order("created_at", { ascending: true });

  if (enrollmentsError) throw enrollmentsError;

  const phasesByStudent = new Map<string, string[]>();
  for (const e of enrollments ?? []) {
    if (!e.student_id) continue;
    const label = e.level_name ? `${e.phase_name} — ${e.level_name}` : e.phase_name;
    const existing = phasesByStudent.get(e.student_id) ?? [];
    if (!existing.includes(label)) existing.push(label);
    phasesByStudent.set(e.student_id, existing);
  }

  return students.map((s) => ({
    ...s,
    phase_label: phasesByStudent.get(s.id)?.join(", ") ?? null,
  }));
}
