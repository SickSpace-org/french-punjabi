"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * studentId null = whole-batch announcement, same convention as
 * sendTeacherMessage (src/app/teacher/actions.ts). admin_send_message()
 * (supabase/038_admin_messages.sql) re-verifies is_admin() itself and,
 * for an individual send, that studentId is currently in that batch — a
 * tampered studentId is rejected by the function, not just hidden by this
 * UI. Admin isn't scoped to a single batch the way a teacher is, so there
 * is no ownership check here at all, by design.
 */
export async function sendAdminMessage(batchId: string, studentId: string | null, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a message first." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_send_message", {
    p_batch_id: batchId,
    p_student_id: studentId,
    p_body: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/messages");
  revalidatePath("/student");
  return { ok: true };
}
