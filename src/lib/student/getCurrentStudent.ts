import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StudentRow } from "@/types/database";

/**
 * Resolves the currently authenticated student's own account row. Called
 * at the top of every /student Server Component and Server Action — every
 * layout/page still independently re-verifies who's asking rather than
 * trusting a value passed down, so a tampered courseId/lessonId in the URL
 * can never ride along on someone else's already-established trust.
 *
 * Wrapped in cache() purely to collapse the network cost of that repeated
 * verification: a single page load nests the portal layout, an optional
 * course layout, and the page itself, each of which calls this — without
 * caching that's 2-3 redundant auth.getUser() + students lookups per
 * request. Caching changes nothing about *when* a request gets denied,
 * only how many times the same already-settled answer gets re-fetched
 * within it.
 */
/**
 * Cached separately from getCurrentStudent so a caller that needs to tell
 * "no session at all" apart from "session exists but isn't an authorized
 * student" (the portal layout, to pick the right redirect/error) can check
 * this first without paying for a second auth.getUser() round trip when it
 * then calls getCurrentStudent — that call reuses this same cached result.
 */
export const getAuthUser = cache(async (supabase: SupabaseClient<Database>) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentStudent = cache(async (supabase: SupabaseClient<Database>): Promise<StudentRow | null> => {
  const user = await getAuthUser(supabase);
  if (!user) return null;

  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return data;
});
