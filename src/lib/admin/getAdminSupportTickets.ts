import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AdminTicketMessage = {
  id: string;
  senderType: "student" | "admin";
  body: string;
  isRead: boolean;
  createdAt: string;
};

export type AdminTicket = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
  messages: AdminTicketMessage[];
};

/**
 * Every student's ticket, admin isn't scoped to any one student the way a
 * teacher is scoped to a batch — sorted by updated_at so a ticket with a
 * fresh student reply resurfaces to the top even if it's old.
 */
export async function getAdminSupportTickets(supabase: SupabaseClient<Database>): Promise<AdminTicket[]> {
  const { data: tickets, error: ticketsError } = await supabase
    .from("student_support_tickets")
    .select("id, student_id, subject, status, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (ticketsError) throw ticketsError;
  if (!tickets || tickets.length === 0) return [];

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, email")
    .in(
      "id",
      Array.from(new Set(tickets.map((t) => t.student_id)))
    );
  if (studentsError) throw studentsError;

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));

  const { data: messages, error: messagesError } = await supabase
    .from("support_ticket_messages")
    .select("id, ticket_id, sender_type, body, is_read, created_at")
    .in(
      "ticket_id",
      tickets.map((t) => t.id)
    )
    .order("created_at", { ascending: true });
  if (messagesError) throw messagesError;

  const messagesByTicketId = new Map<string, AdminTicketMessage[]>();
  for (const m of messages ?? []) {
    const list = messagesByTicketId.get(m.ticket_id) ?? [];
    list.push({ id: m.id, senderType: m.sender_type, body: m.body, isRead: m.is_read, createdAt: m.created_at });
    messagesByTicketId.set(m.ticket_id, list);
  }

  return tickets.map((t) => {
    const student = studentById.get(t.student_id);
    return {
      id: t.id,
      studentId: t.student_id,
      studentName: student?.full_name ?? "Former student",
      studentEmail: student?.email ?? "",
      subject: t.subject,
      status: t.status,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      messages: messagesByTicketId.get(t.id) ?? [],
    };
  });
}
