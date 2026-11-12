import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSIGNMENTS_BUCKET } from "./constants";

export type AssignmentsCleanupResult = { filesRemoved: number; assignmentsRemoved: number; submissionsRemoved: number };

/**
 * Deletes every Assignments file older than 3 days from Storage, then every
 * expired row. Files are found straight from storage.objects (via
 * assignments_expired_objects(), see supabase/066_assignments.sql) rather
 * than from the rows, so a stray upload whose row never got saved is
 * cleaned up too. Safe to run any number of times.
 *
 * Runs daily from the Vercel cron (/api/cron/self-study-cleanup) and,
 * throttled, whenever an Assignments page loads.
 */
export async function purgeExpiredAssignments(): Promise<AssignmentsCleanupResult> {
  const supabase = createAdminClient();

  const { data: names, error: listError } = await supabase.rpc("assignments_expired_objects");
  if (listError) throw listError;

  const paths = (names ?? []) as string[];
  let filesRemoved = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(ASSIGNMENTS_BUCKET).remove(chunk);
    if (error) throw error;
    filesRemoved += data?.length ?? 0;
  }

  const nowIso = new Date().toISOString();
  const [submissions, assignments] = await Promise.all([
    supabase.from("assignment_submissions").delete({ count: "exact" }).lte("expires_at", nowIso),
    supabase.from("assignments").delete({ count: "exact" }).lte("expires_at", nowIso),
  ]);
  if (submissions.error) throw submissions.error;
  if (assignments.error) throw assignments.error;

  return {
    filesRemoved,
    assignmentsRemoved: assignments.count ?? 0,
    submissionsRemoved: submissions.count ?? 0,
  };
}

let lastOpportunisticRun = 0;

/**
 * Page-load trigger for purgeExpiredAssignments(), at most once per 15
 * minutes per server instance. Meant to be called inside next/server's
 * after() so it never slows a page down; failures are only logged.
 */
export async function purgeExpiredAssignmentsThrottled() {
  const now = Date.now();
  if (now - lastOpportunisticRun < 15 * 60 * 1000) return;
  lastOpportunisticRun = now;
  try {
    await purgeExpiredAssignments();
  } catch (error) {
    console.error("[Assignments] Cleanup failed:", error);
  }
}
