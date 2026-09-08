"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Every action here independently re-resolves "who is asking" via
 * getCurrentStudent() and lets Row Level Security be the actual gate on
 * "are they allowed to do this" (has_course_access(), is_active_student(),
 * see supabase/006-008_*.sql) — never trusts a courseId/lessonId passed in
 * from the client on its own. A tampered id in the request body still gets
 * denied by the database, not just hidden by the UI.
 */

export async function markLessonComplete(lessonId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("student_lesson_progress")
    .upsert(
      { student_id: student.id, lesson_id: lessonId },
      { onConflict: "student_id,lesson_id", ignoreDuplicates: true }
    );

  // RLS (progress_self_insert) silently rejects this if the lesson isn't
  // published or the student doesn't have active access to its course —
  // surfaces here as a generic Postgres permission error.
  if (error) return { ok: false, error: "Unable to update progress. Please try again." };

  revalidatePath("/student/courses");
  return { ok: true };
}

export async function postComment(
  lessonId: string,
  body: string,
  parentCommentId?: string
): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a message first." };

  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.from("lesson_comments").insert({
    lesson_id: lessonId,
    student_id: student.id,
    admin_id: null,
    parent_comment_id: parentCommentId ?? null,
    body: trimmed,
  });

  if (error) return { ok: false, error: "Unable to post your message. Please try again." };

  revalidatePath(`/student/courses`);
  return { ok: true };
}

export type SignedUrlResult = { ok: true; url: string } | { ok: false; error: string };

export async function getResourceSignedUrl(resourceId: string): Promise<SignedUrlResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  // RLS (lesson_resources_student_select) only returns this row if the
  // resource's lesson is published and the student has active course
  // access — an unauthorized/tampered resourceId simply comes back null.
  const { data: resource, error } = await supabase
    .from("lesson_resources")
    .select("storage_path")
    .eq("id", resourceId)
    .maybeSingle();

  if (error || !resource) return { ok: false, error: "Resource not found or access denied." };

  const { data: signed, error: signError } = await supabase.storage
    .from("lesson-resources")
    .createSignedUrl(resource.storage_path, 60);

  if (signError || !signed) return { ok: false, error: "Unable to generate a download link." };

  return { ok: true, url: signed.signedUrl };
}

export type MarkAttendanceResult =
  | { ok: true; alreadyMarked: boolean }
  | { ok: false; error: string };

/**
 * Called when a student clicks "Join Class" — calls
 * mark_class_attendance() (supabase/016_attendance.sql), a security-definer
 * function that re-derives the caller's own student_id from auth.uid()
 * server-side and only records today as Present if today is actually one
 * of the batch's scheduled class days. A tampered batchId (one this
 * student isn't in) just records attendance for a batch they aren't
 * assigned to — harmless, since nothing reads it back for them there.
 */
export async function markClassAttendance(batchId: string): Promise<MarkAttendanceResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { data, error } = await supabase.rpc("mark_class_attendance", { p_batch_id: batchId });
  if (error) return { ok: false, error: "Unable to mark attendance. Please try again." };

  if (!data?.ok) {
    return { ok: false, error: "Today isn't a scheduled class day for your batch." };
  }

  revalidatePath("/student/attendance");
  return { ok: true, alreadyMarked: Boolean(data.already_marked) };
}

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("student_notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("student_id", student.id);

  if (error) return { ok: false, error: "Unable to update notification." };
  revalidatePath("/student/notifications");
  return { ok: true };
}
