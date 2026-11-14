import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Who is in each one-on-one slot, for batch pickers: batch id -> student name.
 * The holder is the latest live (not "not interested") enrollment on the slot.
 * Slots nobody has reserved are simply absent. Never throws: pickers still work
 * without names (and before the one-on-one migration has been run).
 */
export async function getOneOnOneHolders(
  supabase: SupabaseClient<Database>,
  batchIds: string[]
): Promise<Map<string, string>> {
  const holders = new Map<string, string>();
  if (batchIds.length === 0) return holders;

  const { data, error } = await supabase
    .from("enrollments")
    .select("batch_id, full_name")
    .in("batch_id", batchIds)
    .neq("status", "NOT_INTERESTED")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[One-on-one] Failed to load slot holders:", error);
    return holders;
  }
  for (const row of data ?? []) {
    if (row.batch_id && !holders.has(row.batch_id)) holders.set(row.batch_id, row.full_name);
  }
  return holders;
}
