import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

/**
 * Students only ever come into existence via confirm_enrollment_payment()
 * (see supabase/005_payments_students.sql / 006_student_accounts.sql) — a
 * row here means an admin has manually verified the Interac e-Transfer for
 * at least one of that person's enrollments. Any ACTIVE student sees every
 * published course automatically (see 010_simplify_access_to_enrolled.sql)
 * — there's no per-student course list to show here.
 */
export async function getAdminStudents(supabase: SupabaseClient<Database>): Promise<StudentRow[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("enrolled_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
