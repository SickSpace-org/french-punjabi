"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTicketReplyNotification } from "@/lib/email/send";
import type { TicketStatus } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * A direct RLS-gated insert, same as every other admin write in this app
 * (student_support_tickets_admin_write / support_ticket_messages_admin_
 * write both grant full access via is_admin() — no RPC indirection
 * needed for admin's own actions, consistent with how admin writes
 * everywhere else).
 *
 * The reply-notification email is scheduled via next/server's after() —
 * NOT awaited inline — so this action returns (and revalidates) the
 * instant the message is saved, rather than blocking on a real network
 * round-trip to Resend. Awaiting it inline previously made this action
 * measurably slower (~900ms, vs ~150ms for setTicketStatus's own plain
 * UPDATE with no email) — real enough that clicking Reply and then
 * quickly clicking Mark Resolved could let setTicketStatus's revalidated
 * response reach the browser and get applied BEFORE this action's own
 * response did, making the just-sent reply appear to vanish from the UI
 * even though it had already committed to the database. after() also
 * guarantees (platform-wise) that the email send is allowed to finish
 * running even though the response has already gone back to the
 * browser — a bare un-awaited promise has no such guarantee in a
 * serverless/edge runtime, which can freeze the function the moment the
 * response is sent.
 */
export async function adminReplyToTicket(
  ticketId: string,
  student: { email: string; fullName: string },
  subject: string,
  body: string
): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a message first." };

  const supabase = await createClient();
  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticketId,
    sender_type: "admin",
    body: trimmed,
  });

  if (error) return { ok: false, error: error.message };

  if (student.email) {
    after(() => sendTicketReplyNotification(student.email, { fullName: student.fullName, subject, body: trimmed }).catch(() => undefined));
  }

  revalidatePath("/admin/support");
  revalidatePath("/student/support");
  return { ok: true };
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("student_support_tickets").update({ status }).eq("id", ticketId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/support");
  revalidatePath("/student/support");
  return { ok: true };
}

export async function markTicketMessagesRead(ticketId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("support_ticket_messages")
    .update({ is_read: true })
    .eq("ticket_id", ticketId)
    .eq("sender_type", "student");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/support");
  return { ok: true };
}
