import { createClient } from "@/lib/supabase/server";
import { getAdminSupportTickets } from "@/lib/admin/getAdminSupportTickets";
import AdminSupportClient from "@/components/admin/support/AdminSupportClient";

export const revalidate = 0;

export default async function AdminSupportPage() {
  const supabase = await createClient();

  let tickets: Awaited<ReturnType<typeof getAdminSupportTickets>> | null = null;
  try {
    tickets = await getAdminSupportTickets(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load support tickets:", error);
  }

  if (!tickets) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Support Tickets</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">Couldn&apos;t load tickets right now. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Support Tickets</h1>
      <p className="mt-1 text-sm text-navy/60">Questions students have sent directly from their portal.</p>

      <div className="mt-8">
        <AdminSupportClient tickets={tickets} />
      </div>
    </div>
  );
}
