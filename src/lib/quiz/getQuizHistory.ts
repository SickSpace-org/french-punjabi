import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, QuizAttemptRow } from "@/types/database";

export async function getQuizHistory(
  supabase: SupabaseClient<Database>,
  studentId: string,
  limit = 10
): Promise<QuizAttemptRow[]> {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}
