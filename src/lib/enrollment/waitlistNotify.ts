import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { sendSeatOpenEmail } from "@/lib/email/send";
import { formatBatchTiming } from "@/lib/courses/batchLabel";

export type WaitlistBatchRow = {
  id: string;
  name: string | null;
  time_label: string;
  timezone: string;
  is_active: boolean;
  availability_status: string;
  total_slots: number | null;
  filled_slots: number;
  phases: { slug: string; title: string } | null;
  levels: { name: string; phases: { slug: string; title: string } | null } | null;
};

export const BATCH_SELECT =
  "id, name, time_label, timezone, is_active, availability_status, total_slots, filled_slots, phases ( slug, title ), levels ( name, phases ( slug, title ) )";

export function describeBatch(batch: WaitlistBatchRow) {
  const phase = batch.phases ?? batch.levels?.phases ?? null;
  const courseName = [phase?.title, batch.levels?.name].filter(Boolean).join(" — ");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return {
    courseName: courseName || "Your batch",
    batchTiming: formatBatchTiming(batch),
    enrollUrl: `${site}${phase ? `/courses/${phase.slug}#batches` : "/courses"}`,
  };
}

export function hasOpenSeat(batch: Pick<WaitlistBatchRow, "is_active" | "availability_status" | "total_slots" | "filled_slots">) {
  if (!batch.is_active || batch.availability_status === "full" || batch.availability_status === "hidden") {
    return false;
  }
  return batch.total_slots == null || batch.total_slots - batch.filled_slots > 0;
}

type AdminSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Called after an admin edits a batch. If the batch now has a free seat,
 * emails everyone still waiting on it (once each) and stamps notified_at.
 * Runs with the admin's session, so RLS limits it to admins. Best-effort:
 * a failure here never fails the admin's edit.
 */
export async function notifyWaitlistIfSeatOpen(supabase: AdminSupabase, batchId: string) {
  await notifyWaitlist(supabase, batchId, { onlyIfSeatOpen: true });
}

/**
 * Emails everyone still waiting on a batch and stamps notified_at. With
 * onlyIfSeatOpen it does nothing unless the batch has a free seat; the
 * admin Waitlist page's "Email now" button skips that check. Returns how
 * many students were emailed.
 */
export async function notifyWaitlist(
  supabase: AdminSupabase,
  batchId: string,
  { onlyIfSeatOpen }: { onlyIfSeatOpen: boolean }
): Promise<number> {
  try {
    const { data } = await supabase.from("batches").select(BATCH_SELECT).eq("id", batchId).maybeSingle();
    const batch = data as unknown as WaitlistBatchRow | null;
    if (!batch || (onlyIfSeatOpen && !hasOpenSeat(batch))) return 0;

    const { data: waiting, error } = await supabase
      .from("batch_waitlist")
      .select("id, full_name, email")
      .eq("batch_id", batchId)
      .is("notified_at", null);
    if (error || !waiting?.length) return 0;

    const info = describeBatch(batch);
    const notifiedIds: string[] = [];
    for (const person of waiting) {
      const result = await sendSeatOpenEmail(person.email, { fullName: person.full_name, ...info });
      if (result.sent) notifiedIds.push(person.id);
    }

    if (notifiedIds.length) {
      await supabase
        .from("batch_waitlist")
        .update({ notified_at: new Date().toISOString() })
        .in("id", notifiedIds);
    }
    return notifiedIds.length;
  } catch (error) {
    console.error("[Waitlist] Failed to notify waitlist:", error);
    return 0;
  }
}
