import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TestSlotRow } from "@/types/database";

export async function getAdminTestSlots(supabase: SupabaseClient<Database>): Promise<TestSlotRow[]> {
  const { data, error } = await supabase
    .from("test_slots")
    .select("*")
    .order("display_order", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
