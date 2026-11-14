import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Read-only checks for "is this batch a personalised one-on-one slot?", used
 * by every enrollment path that must NOT sell one at a normal phase price
 * (Stripe checkout, phase re-enrollment). They are separate small queries on
 * purpose, and they swallow errors (answering "no"): if the column isn't there
 * yet because supabase/067 hasn't been run, those paths keep working exactly
 * as before instead of failing for everyone.
 */
export async function isOneOnOneBatch(supabase: SupabaseClient<Database>, batchId: string): Promise<boolean> {
  const { data, error } = await supabase.from("batches").select("is_one_on_one").eq("id", batchId).maybeSingle();
  if (error) return false;
  return Boolean(data?.is_one_on_one);
}

/** Every one-on-one slot id, for filtering them out of lists of ordinary batches. */
export async function oneOnOneBatchIds(supabase: SupabaseClient<Database>): Promise<Set<string>> {
  const { data, error } = await supabase.from("batches").select("id").eq("is_one_on_one", true);
  if (error) return new Set();
  return new Set((data ?? []).map((b) => b.id));
}

/** A slot's one-on-one flag plus its hold count, in one tolerant read. */
export async function getOneOnOneSlotInfo(
  supabase: SupabaseClient<Database>,
  batchId: string
): Promise<{ isOneOnOne: boolean; held: number }> {
  const { data, error } = await supabase
    .from("batches")
    .select("is_one_on_one, held_slots")
    .eq("id", batchId)
    .maybeSingle();
  if (error || !data) return { isOneOnOne: false, held: 0 };
  return { isOneOnOne: Boolean(data.is_one_on_one), held: data.held_slots ?? 0 };
}
