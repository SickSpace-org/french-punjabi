import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getMyTestSlot } from "@/lib/student/getMyTestSlot";
import TestSlotView from "@/components/student/TestSlotView";

export const revalidate = 0;

export default async function StudentTestPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null; // layout guard already handles this — defensive only

  const slot = await getMyTestSlot(supabase, student.id);

  return <TestSlotView slot={slot} />;
}
