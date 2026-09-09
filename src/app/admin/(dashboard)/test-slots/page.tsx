import { createClient } from "@/lib/supabase/server";
import { getAdminTestSlots } from "@/lib/testSlots/getAdminTestSlots";
import TestSlotsClient from "@/components/admin/testSlots/TestSlotsClient";

export const revalidate = 0;

export default async function AdminTestSlotsPage() {
  const supabase = await createClient();

  let slots: Awaited<ReturnType<typeof getAdminTestSlots>> | null = null;
  try {
    slots = await getAdminTestSlots(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load test slots:", error);
  }

  if (!slots) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Test Slots</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load test slots right now. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return <TestSlotsClient initialSlots={slots} />;
}
