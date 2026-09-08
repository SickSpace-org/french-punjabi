import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { scheduledDatesInWindow } from "@/lib/attendance/schedule";

export type AttendanceDay = { date: string; present: boolean };

/**
 * This student's Present/Absent for every scheduled class date (today or
 * earlier) in the rolling window — most recent first. Same window/logic
 * getAdminAttendance.ts uses for the admin grid, so a student's own history
 * always matches what an admin sees for them.
 */
export async function getMyAttendance(
  supabase: SupabaseClient<Database>,
  studentId: string,
  batchId: string,
  classDays: number[]
): Promise<AttendanceDay[]> {
  const dates = scheduledDatesInWindow(classDays);
  if (dates.length === 0) return [];

  const { data, error } = await supabase
    .from("attendance")
    .select("class_date")
    .eq("student_id", studentId)
    .eq("batch_id", batchId)
    .in("class_date", dates);

  if (error) throw error;

  const presentSet = new Set((data ?? []).map((r) => r.class_date));
  return dates.map((date) => ({ date, present: presentSet.has(date) })).reverse();
}
