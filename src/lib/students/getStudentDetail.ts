import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessStatus, Database, StudentRow } from "@/types/database";

export type StudentAccessRow = {
  id: string;
  status: AccessStatus;
  granted_at: string;
  revoked_at: string | null;
  courseId: string;
  courseTitle: string;
  phaseTitle: string;
  levelName: string | null;
};

export type StudentDetail = StudentRow & { access: StudentAccessRow[] };

export type AssignableCourse = { id: string; title: string; phaseTitle: string; levelName: string | null };

type StudentQueryRow = StudentRow & {
  student_course_access: {
    id: string;
    status: AccessStatus;
    granted_at: string;
    revoked_at: string | null;
    course_content: {
      id: string;
      title: string;
      phases: { title: string } | null;
      levels: { name: string } | null;
    } | null;
  }[];
};

export async function getStudentDetail(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<StudentDetail | null> {
  const { data, error } = await supabase
    .from("students")
    .select(
      `*,
       student_course_access (
         id, status, granted_at, revoked_at,
         course_content ( id, title, phases ( title ), levels ( name ) )
       )`
    )
    .eq("id", studentId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as StudentQueryRow;
  const { student_course_access, ...student } = row;

  return {
    ...student,
    access: student_course_access
      .filter((a) => a.course_content != null)
      .map((a) => ({
        id: a.id,
        status: a.status,
        granted_at: a.granted_at,
        revoked_at: a.revoked_at,
        courseId: a.course_content!.id,
        courseTitle: a.course_content!.title,
        phaseTitle: a.course_content!.phases?.title ?? "—",
        levelName: a.course_content!.levels?.name ?? null,
      })),
  };
}

/** Every active, published course — for the "+ Assign Course" picker. */
export async function getAssignableCourses(supabase: SupabaseClient<Database>): Promise<AssignableCourse[]> {
  const { data, error } = await supabase
    .from("course_content")
    .select("id, title, phases ( title ), levels ( name )")
    .eq("is_active", true)
    .order("display_order");

  if (error) throw error;

  return ((data ?? []) as unknown as {
    id: string;
    title: string;
    phases: { title: string } | null;
    levels: { name: string } | null;
  }[]).map((c) => ({
    id: c.id,
    title: c.title,
    phaseTitle: c.phases?.title ?? "—",
    levelName: c.levels?.name ?? null,
  }));
}
