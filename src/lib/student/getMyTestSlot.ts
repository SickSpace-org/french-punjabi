import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type MyTestSlot = {
  startTime: string; // "HH:MM:SS"
  meetingLink: string | null;
  note: string | null;
};

/**
 * This student's individually assigned Friday test slot
 * (student_test_slots, supabase/024_student_test_slots.sql) — the admin
 * sets this per student on /admin/test-slots. Null until the admin has
 * assigned one.
 */
export async function getMyTestSlot(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<MyTestSlot | null> {
  const { data } = await supabase
    .from("student_test_slots")
    .select("start_time, meeting_link, note")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!data) return null;

  return {
    startTime: data.start_time,
    meetingLink: data.meeting_link,
    note: data.note,
  };
}
