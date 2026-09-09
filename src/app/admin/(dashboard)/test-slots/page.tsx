import { createClient } from "@/lib/supabase/server";
import { getAdminTestSlots } from "@/lib/testSlots/getAdminTestSlots";
import { getAdminStudentTestSlots } from "@/lib/testSlots/getAdminStudentTestSlots";
import TestSlotsClient from "@/components/admin/testSlots/TestSlotsClient";
import StudentTestSlotsTable from "@/components/admin/testSlots/StudentTestSlotsTable";

export const revalidate = 0;

export default async function AdminTestSlotsPage() {
  const supabase = await createClient();

  let slots: Awaited<ReturnType<typeof getAdminTestSlots>> | null = null;
  let studentSlots: Awaited<ReturnType<typeof getAdminStudentTestSlots>> | null = null;
  try {
    [slots, studentSlots] = await Promise.all([
      getAdminTestSlots(supabase),
      getAdminStudentTestSlots(supabase),
    ]);
  } catch (error) {
    console.error("[Admin] Failed to load test slots:", error);
  }

  if (!slots || !studentSlots) {
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

  return (
    <div>
      <TestSlotsClient initialSlots={slots} />
      <StudentTestSlotsTable students={studentSlots} />
    </div>
  );
}
