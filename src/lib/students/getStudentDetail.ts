import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

export type StudentDetail = StudentRow & { portalPassword: string | null };

export async function getStudentDetail(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<StudentDetail | null> {
  const [studentResult, credentialResult] = await Promise.all([
    supabase.from("students").select("*").eq("id", studentId).maybeSingle(),
    supabase
      .from("student_portal_credentials")
      .select("password")
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  if (studentResult.error) throw studentResult.error;
  if (!studentResult.data) return null;

  return { ...studentResult.data, portalPassword: credentialResult.data?.password ?? null };
}
