import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TeacherRow } from "@/types/database";

/**
 * Resolves the currently authenticated teacher's own account row. Mirrors
 * getCurrentStudent (src/lib/student/getCurrentStudent.ts) exactly — see
 * that file for the full reasoning on why every /teacher Server
 * Component/Action independently re-verifies this rather than trusting a
 * value passed down.
 */
export const getAuthUser = cache(async (supabase: SupabaseClient<Database>) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentTeacher = cache(async (supabase: SupabaseClient<Database>): Promise<TeacherRow | null> => {
  const user = await getAuthUser(supabase);
  if (!user) return null;

  const { data } = await supabase
    .from("teachers")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data;
});
