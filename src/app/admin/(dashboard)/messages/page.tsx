import { createClient } from "@/lib/supabase/server";
import { getAdminMessagesData } from "@/lib/admin/getAdminMessagesData";
import AdminMessagesClient from "@/components/admin/messages/AdminMessagesClient";

export const revalidate = 0;

export default async function AdminMessagesPage() {
  const supabase = await createClient();

  let data: Awaited<ReturnType<typeof getAdminMessagesData>> | null = null;
  try {
    data = await getAdminMessagesData(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load messages data:", error);
  }

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Messages</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">Couldn&apos;t load messages right now. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Messages</h1>
      <p className="mt-1 text-sm text-navy/60">
        Send an announcement to an entire batch, or a message to one student — across any batch, not just one
        teacher&apos;s assignment. Students see these clearly marked as from Admin, separate from their teacher&apos;s
        own messages.
      </p>

      <div className="mt-8">
        <AdminMessagesClient batches={data.batches} students={data.students} sentMessages={data.sentMessages} />
      </div>
    </div>
  );
}
