import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type StudentTicketMessage = {
  id: string;
  senderType: "student" | "admin";
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type StudentTicket = {
  id: string;
  subject: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
  messages: StudentTicketMessage[];
};

/**
 * All of this student's own tickets (own via student_support_tickets_
 * student_select's is_own_student_id check), newest-active first — a
 * RESOLVED ticket a student replies to reopens automatically (see
 * touch_ticket_on_new_message(), supabase/039_student_support_tickets.sql),
 * so "most recently updated" is the right sort for them too, not just admin.
 */
export async function getStudentSupportTickets(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<StudentTicket[]> {
  const { data: tickets, error: ticketsError } = await supabase
    .from("student_support_tickets")
    .select("id, subject, status, created_at, updated_at")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });
  if (ticketsError) throw ticketsError;
  if (!tickets || tickets.length === 0) return [];

  const { data: messages, error: messagesError } = await supabase
    .from("support_ticket_messages")
    .select("id, ticket_id, sender_type, body, is_read, created_at")
    .in(
      "ticket_id",
      tickets.map((t) => t.id)
    )
    .order("created_at", { ascending: true });
  if (messagesError) throw messagesError;

  const messagesByTicketId = new Map<string, StudentTicketMessage[]>();
  for (const m of messages ?? []) {
    const list = messagesByTicketId.get(m.ticket_id) ?? [];
    list.push({ id: m.id, senderType: m.sender_type, body: m.body, isRead: m.is_read, createdAt: m.created_at });
    messagesByTicketId.set(m.ticket_id, list);
  }

  return tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    messages: messagesByTicketId.get(t.id) ?? [],
  }));
}

/**
 * Count-only, same reasoning as getUnreadNotificationCount
 * (src/lib/student/getNotifications.ts) — used for the "Support" nav
 * badge, kept deliberately separate from that count rather than merged
 * into it, since tickets are a distinct inbox, not part of the merged
 * notifications feed (see the Phase 8 plan).
 *
 * support_ticket_messages has no direct student_id column (only
 * ticket_id), so unlike getUnreadNotificationCount this can't add an
 * extra .eq("student_id", ...) filter for defense in depth without an
 * embedded join — and this project's hand-maintained Database type
 * declares empty Relationships on every table, so an embedded-join
 * filter wouldn't type-check cleanly here. RLS
 * (support_ticket_messages_student_select -> is_own_ticket()) is the
 * real, already-proven boundary — see this project's own stated
 * philosophy throughout: RLS is the security boundary, app-level
 * filtering is defense in depth where it's cheap, not a requirement
 * everywhere.
 */
export async function getUnreadTicketReplyCount(supabase: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await supabase
    .from("support_ticket_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_type", "admin")
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}
