"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { sendNewTicketNotification } from "@/lib/email/send";

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
 * mark_class_attendance() (supabase/019_attendance_time_window_and_admin_override.sql),
 * a security-definer function that re-derives the caller's own student_id
 * from auth.uid() server-side and only records today as Present if today is
 * actually one of the batch's scheduled class days AND (when the batch has
 * a class_time set) the click lands within 30 minutes either side of it. A
 * tampered batchId (one this student isn't in) just records attendance for
 * a batch they aren't assigned to — harmless, since nothing reads it back
 * for them there.
 */
export async function markClassAttendance(batchId: string): Promise<MarkAttendanceResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { data, error } = await supabase.rpc("mark_class_attendance", { p_batch_id: batchId });
  if (error) return { ok: false, error: "Unable to mark attendance. Please try again." };

  if (!data?.ok) {
    const error =
      data?.reason === "outside_window"
        ? "You weren't marked present — check in within 30 minutes of class start time."
        : "Today isn't a scheduled class day for your batch.";
    return { ok: false, error };
  }

  revalidatePath("/student/attendance");
  return { ok: true, alreadyMarked: Boolean(data.already_marked) };
}

/**
 * `kind` picks which of the two tables getStudentNotifications() merged
 * this row from (see supabase/036_teacher_messages.sql for why they're
 * separate tables) — "teacher_message" and "admin_message" are both rows
 * in teacher_messages (see supabase/038_admin_messages.sql's is_admin_message
 * flag), just different display kinds of the same underlying table/column.
 * Same student_id ownership check either way, RLS (notifications_self_update
 * / teacher_messages_student_update) is the real gate on both.
 */
export async function markNotificationRead(
  notificationId: string,
  kind: "lesson_reply" | "teacher_message" | "admin_message"
): Promise<ActionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const table = kind === "lesson_reply" ? "student_notifications" : "teacher_messages";
  const { error } = await supabase
    .from(table)
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("student_id", student.id);

  if (error) return { ok: false, error: "Unable to update notification." };
  revalidatePath("/student/notifications");
  revalidatePath("/student");
  // The bell badge count is fetched in the shared portal layout
  // (src/app/student/(portal)/layout.tsx via getUnreadNotificationCount),
  // not in either page above — revalidatePath on a page path only busts
  // that page's own cache, not the layout wrapping it. Without this, the
  // write succeeds (confirmed directly against the database) but the
  // badge keeps showing the stale pre-read count until some other
  // navigation happens to force a fresh layout render.
  revalidatePath("/student", "layout");
  return { ok: true };
}

/**
 * A student can reply to a feedback note addressed to them, but can never
 * start a new one (see supabase/037_student_feedback_notes.sql — the
 * student_insert RLS policy requires parent_note_id is not null). Only
 * body + parent_note_id are sent — enforce_feedback_note_reply() derives
 * batch_id/teacher_id/teacher_name_snapshot/student_id from the parent
 * row itself, never from this client payload, so there's nothing here to
 * spoof.
 */
export async function replyToFeedbackNote(noteId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a reply first." };

  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.from("student_feedback_notes").insert({
    parent_note_id: noteId,
    body: trimmed,
  });

  if (error) return { ok: false, error: "Unable to send your reply. Please try again." };
  revalidatePath("/student");
  return { ok: true };
}

/**
 * The only way a new support ticket is created — student_open_ticket()
 * (supabase/039_student_support_tickets.sql) writes the ticket row and
 * its first message atomically, so a partial failure never leaves an
 * empty, message-less ticket behind. The admin-notification email is
 * best-effort: a failure here must never fail the ticket creation itself,
 * which has already succeeded by the time this fires.
 */
export async function openSupportTicket(subject: string, body: string): Promise<ActionResult> {
  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!trimmedSubject) return { ok: false, error: "Please give your ticket a subject." };
  if (!trimmedBody) return { ok: false, error: "Please describe what you need help with." };

  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.rpc("student_open_ticket", { p_subject: trimmedSubject, p_body: trimmedBody });
  if (error) return { ok: false, error: error.message };

  // Scheduled via after() rather than awaited — same fix as
  // adminReplyToTicket (src/app/admin/(dashboard)/support/actions.ts):
  // this must not block the action's return on a real network round-trip
  // to Resend, which could otherwise race against some other quick
  // follow-up action's own (faster) revalidation.
  after(() => sendNewTicketNotification({ studentName: student.full_name, subject: trimmedSubject, body: trimmedBody }).catch(() => undefined));

  revalidatePath("/student/support");
  return { ok: true };
}

/**
 * A direct RLS-gated insert (no RPC) — support_ticket_messages_student_
 * insert forces sender_type to 'student' and requires is_own_ticket(),
 * so a tampered ticketId for someone else's ticket is rejected by the
 * database, not just hidden by this UI.
 */
export async function replyToTicket(ticketId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a message first." };

  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    sender_type: "student",
    body: trimmed,
  });

  if (error) return { ok: false, error: "Unable to send your reply. Please try again." };
  revalidatePath("/student/support");
  return { ok: true };
}

export async function markTicketMessageRead(messageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase.from("support_ticket_messages").update({ is_read: true }).eq("id", messageId);
  if (error) return { ok: false, error: "Unable to update message." };
  revalidatePath("/student/support");
  // Same gap as markNotificationRead above — the "Talk to Admin" nav badge
  // (getUnreadTicketReplyCount) is fetched in the shared portal layout,
  // not on this page, so a page-only revalidation leaves it stale.
  revalidatePath("/student", "layout");
  return { ok: true };
}
