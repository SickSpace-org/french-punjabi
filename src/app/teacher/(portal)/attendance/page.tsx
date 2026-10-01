import { createClient } from "@/lib/supabase/server";
import { getCurrentTeacher } from "@/lib/teachers/getCurrentTeacher";
import { getTeacherAttendance } from "@/lib/teachers/getTeacherAttendance";
import TeacherAttendanceClient from "@/components/teacher/TeacherAttendanceClient";

export const revalidate = 0;

export default async function TeacherAttendancePage() {
  const supabase = await createClient();
  const teacher = await getCurrentTeacher(supabase);

  let batches: Awaited<ReturnType<typeof getTeacherAttendance>> | null = null;
  if (teacher) {
    try {
      batches = await getTeacherAttendance(supabase, teacher.id);
    } catch (error) {
      console.error("[Teacher] Failed to load attendance:", error);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Attendance</h1>
      <p className="mt-1 text-sm text-navy/60">
        Your assigned batch(es) only. Click any date to toggle Present/Absent.
      </p>

      {!batches ? (
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load attendance right now. Please refresh the page.
          </p>
        </div>
      ) : (
        <TeacherAttendanceClient batches={batches} />
      )}
    </div>
  );
}
