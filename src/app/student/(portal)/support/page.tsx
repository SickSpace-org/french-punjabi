import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStudentSupportTickets } from "@/lib/student/getSupportTickets";
import SupportTicketsClient from "@/components/student/SupportTicketsClient";

export const revalidate = 0;

export default async function StudentSupportPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null;

  const tickets = await getStudentSupportTickets(supabase, student.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Talk to Admin</h1>
      <p className="mt-1 text-sm text-navy/60">
        Have a question for the AngrishFrançais team? Open a ticket here and we&apos;ll reply right in this page.
      </p>

      <div className="mt-6">
        <SupportTicketsClient tickets={tickets} />
      </div>
    </div>
  );
}
