import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessStatus, Database, StudentRow } from "@/types/database";

export type AdminStudentCourse = {
  accessId: string;
  courseId: string;
  courseTitle: string;
  status: AccessStatus;
};

export type AdminStudentRow = StudentRow & { courses: AdminStudentCourse[] };

type StudentQueryRow = StudentRow & {
  student_course_access: {
    id: string;
    status: AccessStatus;
    course_content: { id: string; title: string } | null;
  }[];
};

/**
 * Students only ever come into existence via confirm_enrollment_payment()
 * (see supabase/005_payments_students.sql / 006_student_accounts.sql) — a
 * row here means an admin has manually verified the Interac e-Transfer for
 * at least one of that person's enrollments. Course assignment now lives
 * on student_course_access (see 007_course_content.sql), not on this row
 * directly, since one account can span multiple courses.
 */
export async function getAdminStudents(supabase: SupabaseClient<Database>): Promise<AdminStudentRow[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*, student_course_access ( id, status, course_content ( id, title ) )")
    .order("enrolled_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as StudentQueryRow[]).map((row) => {
    const { student_course_access, ...student } = row;
    return {
      ...student,
      courses: student_course_access
        .filter((access) => access.course_content != null)
        .map((access) => ({
          accessId: access.id,
          courseId: access.course_content!.id,
          courseTitle: access.course_content!.title,
          status: access.status,
        })),
    };
  });
}
