import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getCurrentBatch } from "@/lib/student/getCurrentBatch";
import { getMyAttendance } from "@/lib/student/getMyAttendance";
import AttendanceView from "@/components/student/AttendanceView";

export const revalidate = 0;

export default async function StudentAttendancePage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null; // layout guard already handles this — defensive only

  const batch = await getCurrentBatch(supabase, student.id);
  const history = batch ? await getMyAttendance(supabase, student.id, batch.batchId, batch.classDays) : [];

  return <AttendanceView batch={batch} history={history} />;
}
