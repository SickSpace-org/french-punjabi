import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AdminStudentTestSlot = {
  studentId: string;
  fullName: string;
  startTime: string | null; // "HH:MM:SS", null if not yet assigned
  meetingLink: string | null;
  note: string | null;
};

/**
 * Every ACTIVE student, left-joined with their individually assigned Friday
 * test time (student_test_slots, supabase/024_student_test_slots.sql) — the
 * admin sets a time per student here instead of one shared time for
 * everyone. Students with no row yet show startTime: null.
 */
export async function getAdminStudentTestSlots(
  supabase: SupabaseClient<Database>
): Promise<AdminStudentTestSlot[]> {
  const [studentsResult, slotsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name")
      .eq("status", "ACTIVE")
      .order("full_name", { ascending: true }),
    supabase.from("student_test_slots").select("student_id, start_time, meeting_link, note"),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (slotsResult.error) throw slotsResult.error;

  const slotByStudentId = new Map((slotsResult.data ?? []).map((s) => [s.student_id, s]));

  return (studentsResult.data ?? []).map((student) => {
    const slot = slotByStudentId.get(student.id);
    return {
      studentId: student.id,
      fullName: student.full_name,
      startTime: slot?.start_time ?? null,
      meetingLink: slot?.meeting_link ?? null,
      note: slot?.note ?? null,
    };
  });
}
