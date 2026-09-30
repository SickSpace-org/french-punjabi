import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { BATCH_SELECT, describeBatch, hasOpenSeat, type WaitlistBatchRow } from "@/lib/enrollment/waitlistNotify";

type AdminSupabase = Awaited<ReturnType<typeof createClient>>;

export type AdminWaitlistEntry = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  message: string | null;
  createdAt: string;
  notifiedAt: string | null;
};

export type AdminWaitlistBatch = {
  batchId: string;
  courseName: string;
  batchTiming: string;
  /** e.g. "Full", "2 seats left", "Open", "Inactive". */
  seatLabel: string;
  hasOpenSeat: boolean;
  entries: AdminWaitlistEntry[];
};

/** Thrown when supabase/030_batch_waitlist.sql hasn't been run yet. */
export class WaitlistTableMissingError extends Error {}

function seatLabel(batch: WaitlistBatchRow) {
  if (!batch.is_active) return "Inactive";
  if (batch.availability_status === "full") return "Full";
  if (batch.total_slots == null) return "Open";
  const left = batch.total_slots - batch.filled_slots;
  return left > 0 ? `${left} seat${left === 1 ? "" : "s"} left` : "Full";
}

/** Every waitlist sign-up, grouped by batch, batches with people still waiting first. */
export async function getAdminWaitlist(supabase: AdminSupabase): Promise<AdminWaitlistBatch[]> {
  const { data: rows, error } = await supabase
    .from("batch_waitlist")
    .select("id, batch_id, full_name, email, phone, message, created_at, notified_at")
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") throw new WaitlistTableMissingError(error.message);
    throw error;
  }
  if (!rows.length) return [];

  const batchIds = [...new Set(rows.map((r) => r.batch_id))];
  const { data: batchData, error: batchError } = await supabase
    .from("batches")
    .select(BATCH_SELECT)
    .in("id", batchIds);
  if (batchError) throw batchError;

  const batches = new Map(
    ((batchData ?? []) as unknown as WaitlistBatchRow[]).map((b) => [b.id, b])
  );

  const groups = new Map<string, AdminWaitlistBatch>();
  for (const row of rows) {
    let group = groups.get(row.batch_id);
    if (!group) {
      const batch = batches.get(row.batch_id);
      const info = batch ? describeBatch(batch) : null;
      group = {
        batchId: row.batch_id,
        courseName: info?.courseName ?? "Unknown batch",
        batchTiming: info?.batchTiming ?? "",
        seatLabel: batch ? seatLabel(batch) : "Removed",
        hasOpenSeat: batch ? hasOpenSeat(batch) : false,
        entries: [],
      };
      groups.set(row.batch_id, group);
    }
    group.entries.push({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      message: row.message,
      createdAt: row.created_at,
      notifiedAt: row.notified_at,
    });
  }

  const waitingCount = (g: AdminWaitlistBatch) => g.entries.filter((e) => !e.notifiedAt).length;
  return [...groups.values()].sort((a, b) => waitingCount(b) - waitingCount(a));
}
