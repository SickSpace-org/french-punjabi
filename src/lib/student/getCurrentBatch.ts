import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type CurrentBatchInfo = {
  batchId: string;
  meetingLink: string | null;
  classDays: number[];
  timeLabel: string;
  timezone: string;
};

/**
 * Same "current batch" concept the admin side uses (getAdminStudents'
 * current_batch_id, getAdminAttendance's grouping) — the batch on this
 * student's most recently confirmed enrollment that actually has a
 * batch_id set (a program-offer enrollment has none). Null if they have no
 * batch-based enrollment yet, or the batch itself is gone.
 */
export async function getCurrentBatch(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<CurrentBatchInfo | null> {
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("batch_id")
    .eq("student_id", studentId)
    .not("batch_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enrollment?.batch_id) return null;

  const { data: batch } = await supabase
    .from("batches")
    .select("id, meeting_link, class_days, time_label, timezone")
    .eq("id", enrollment.batch_id)
    .maybeSingle();

  if (!batch) return null;

  return {
    batchId: batch.id,
    meetingLink: batch.meeting_link,
    classDays: batch.class_days,
    timeLabel: batch.time_label,
    timezone: batch.timezone,
  };
}
