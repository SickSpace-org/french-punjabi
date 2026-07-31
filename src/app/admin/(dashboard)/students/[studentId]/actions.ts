"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateStudent(studentId: string) {
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);
}

/**
 * Relies on Supabase RLS (public.is_admin()) as the real authorization
 * boundary, same as the other admin actions files — the server client
 * carries the caller's session, so a non-admin session's write is
 * rejected by the database regardless of this file.
 */
export async function assignCourseAccess(studentId: string, courseId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Re-granting a previously revoked course must reactivate the existing
  // row, not violate the (student_id, course_id) unique constraint with a
  // second insert.
  const { data: existing } = await supabase
    .from("student_course_access")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "ACTIVE") return { ok: true };
    const { error } = await supabase
      .from("student_course_access")
      .update({ status: "ACTIVE", granted_at: new Date().toISOString(), revoked_at: null })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidateStudent(studentId);
    return { ok: true };
  }

  const { error } = await supabase
    .from("student_course_access")
    .insert({ student_id: studentId, course_id: courseId, enrollment_id: null });

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}

export async function revokeCourseAccess(accessId: string, studentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_course_access")
    .update({ status: "REVOKED", revoked_at: new Date().toISOString() })
    .eq("id", accessId);

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}

export async function restoreCourseAccess(accessId: string, studentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_course_access")
    .update({ status: "ACTIVE", granted_at: new Date().toISOString(), revoked_at: null })
    .eq("id", accessId);

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}

export async function suspendStudent(studentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ status: "SUSPENDED" })
    .eq("id", studentId);

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}

export async function reactivateStudent(studentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ status: "ACTIVE" }).eq("id", studentId);

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}
