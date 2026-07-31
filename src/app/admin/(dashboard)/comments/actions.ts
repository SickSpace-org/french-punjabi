"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Relies on Supabase RLS (public.is_admin()) as the real authorization
 * boundary — the server client carries the caller's session, so a
 * non-admin session's write is rejected by the database regardless of
 * this file.
 */
export async function replyToComment(questionId: string, body: string): Promise<ActionResult> {
  if (!body.trim()) return { ok: false, error: "Reply cannot be empty." };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: question, error: questionError } = await supabase
    .from("lesson_comments")
    .select("id, student_id, lesson_id")
    .eq("id", questionId)
    .maybeSingle();

  if (questionError || !question || !question.student_id) {
    return { ok: false, error: "Question not found." };
  }

  const { data: reply, error: insertError } = await supabase
    .from("lesson_comments")
    .insert({
      lesson_id: question.lesson_id,
      student_id: null,
      admin_id: user.id,
      parent_comment_id: question.id,
      body: body.trim(),
    })
    .select("id")
    .single();

  if (insertError || !reply) {
    return { ok: false, error: insertError?.message ?? "Failed to save reply." };
  }

  const { error: notificationError } = await supabase.from("student_notifications").insert({
    student_id: question.student_id,
    lesson_id: question.lesson_id,
    comment_id: reply.id,
    message: "Your teacher replied to your question.",
  });

  if (notificationError) {
    // Best-effort — the reply itself is already saved and visible; a
    // missed notification shouldn't be reported as a failed reply.
    console.error("[Comments] Failed to create student notification:", notificationError);
  }

  revalidatePath("/admin/comments");
  return { ok: true };
}
