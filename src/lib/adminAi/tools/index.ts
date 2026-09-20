import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildCourseTools } from "./courses";
import { buildStudentTools } from "./students";
import { buildEnrollmentTools } from "./enrollments";
import { buildTestSlotTools } from "./testSlots";
import { buildCommentTools } from "./comments";

/**
 * Every tool the admin AI assistant can call, across every section of the
 * admin panel — Courses/Swap Batches, Students, Enrollments, Test Slots,
 * and Comments. Each one wraps an existing, already-RLS-gated admin action
 * or query rather than writing to the database directly, so this can never
 * do anything a human admin couldn't already do by hand through the
 * regular admin pages.
 *
 * Deliberately NOT covered: Content (course videos/lessons/resources — a
 * file-upload-heavy CMS workflow that doesn't fit a text chat tool) and any
 * account-deleting or password-setting action (kept manual/deliberate — see
 * students.ts's header comment).
 */
export function buildAdminAiTools(supabase: SupabaseClient<Database>) {
  return {
    ...buildCourseTools(supabase),
    ...buildStudentTools(supabase),
    ...buildEnrollmentTools(supabase),
    ...buildTestSlotTools(supabase),
    ...buildCommentTools(supabase),
  };
}
