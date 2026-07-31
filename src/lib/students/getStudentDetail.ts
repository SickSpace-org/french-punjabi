import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

export type StudentDetail = StudentRow;

export async function getStudentDetail(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<StudentDetail | null> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
