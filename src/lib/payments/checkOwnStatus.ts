"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";

/** Used only by the SUSPENDED screen's post-Portal polling — resolves the
 * caller's own status exclusively (same pattern as createOwnPortalSession),
 * never accepts a studentId. */
export async function checkOwnStatus(): Promise<{ status: string } | null> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null;
  return { status: student.status };
}
