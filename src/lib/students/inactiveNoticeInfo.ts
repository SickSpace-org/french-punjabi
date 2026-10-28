import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { NOTICE_STALE_PENDING_HOURS } from "@/lib/email/inactiveNoticeConstants";

export type InactiveNoticeInfo = {
  /** False while migration 062 has not been applied (or the table cannot be read): the page still loads, sending is off. */
  logReady: boolean;
  /** student id -> ISO time of the last email that Resend accepted. */
  lastSentByStudent: Record<string, string>;
  /** A send that was stopped part-way and can still be resumed (newest run with pending rows, not older than 48 hours). */
  pendingRun: { runId: string; pending: number; total: number } | null;
};

const EMPTY: InactiveNoticeInfo = { logReady: false, lastSentByStudent: {}, pendingRun: null };

/**
 * Read with the signed-in admin's session (the table's policy lets only admins read it). Never throws: any problem, including the
 * table not existing yet, returns logReady:false so the Inactive Students page keeps working.
 */
export async function getInactiveNoticeInfo(supabase: SupabaseClient<Database>): Promise<InactiveNoticeInfo> {
  try {
    const { data, error } = await supabase
      .from("inactive_notice_log")
      .select("run_id, student_id, status, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      if (error.code !== "PGRST205" && error.code !== "42P01") {
        console.error("[Admin] Could not read inactive_notice_log:", error);
      }
      return EMPTY;
    }

    const lastSentByStudent: Record<string, string> = {};
    const runs = new Map<string, { pending: number; total: number; newest: string }>();
    const cutoff = Date.now() - NOTICE_STALE_PENDING_HOURS * 3_600_000;

    for (const row of data ?? []) {
      if (row.status === "sent" && row.sent_at) {
        const previous = lastSentByStudent[row.student_id];
        if (!previous || row.sent_at > previous) lastSentByStudent[row.student_id] = row.sent_at;
      }
      const run = runs.get(row.run_id) ?? { pending: 0, total: 0, newest: row.created_at };
      run.total += 1;
      if (row.status === "pending") run.pending += 1;
      if (row.created_at > run.newest) run.newest = row.created_at;
      runs.set(row.run_id, run);
    }

    let pendingRun: InactiveNoticeInfo["pendingRun"] = null;
    let newest = "";
    for (const [runId, run] of runs) {
      if (run.pending > 0 && new Date(run.newest).getTime() >= cutoff && run.newest > newest) {
        newest = run.newest;
        pendingRun = { runId, pending: run.pending, total: run.total };
      }
    }

    return { logReady: true, lastSentByStudent, pendingRun };
  } catch (error) {
    console.error("[Admin] Unexpected error reading inactive_notice_log:", error);
    return EMPTY;
  }
}
