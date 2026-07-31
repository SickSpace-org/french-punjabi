import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

/**
 * Resolves the currently authenticated student's own account row. Used at
 * the top of every /student Server Component and Server Action — each one
 * independently re-verifies who's asking rather than trusting a cached
 * value, so a tampered courseId/lessonId in the URL can never ride along
 * on someone else's already-established trust.
 */
export async function getCurrentStudent(supabase: SupabaseClient<Database>): Promise<StudentRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data;
}
