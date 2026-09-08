import { createClient } from "@/lib/supabase/server";
import { getAdminAttendance } from "@/lib/attendance/getAdminAttendance";
import AttendanceClient from "@/components/admin/attendance/AttendanceClient";

export const revalidate = 0;

export default async function AdminAttendancePage() {
  const supabase = await createClient();

  let groups: Awaited<ReturnType<typeof getAdminAttendance>> | null = null;
  try {
    groups = await getAdminAttendance(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load attendance:", error);
  }

  if (!groups) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Attendance</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load attendance right now. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return <AttendanceClient initialGroups={groups} />;
}
