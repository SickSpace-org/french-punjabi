import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TestSlotRow } from "@/types/database";

export type UpcomingTestSlot = {
  title: string;
  startTime: string; // "HH:MM:SS"
  durationMinutes: number;
  meetingLink: string | null;
  note: string | null;
};

/**
 * The active weekly mock test slot admins configure on /admin/test-slots
 * (supabase/023_test_slots.sql) — always a Friday, so unlike getCurrentBatch
 * there's no day-of-week to read, just the time/duration/link the admin set.
 * Picks the earliest-configured active slot if more than one exists.
 */
export async function getUpcomingTestSlot(
  supabase: SupabaseClient<Database>
): Promise<UpcomingTestSlot | null> {
  const { data } = await supabase
    .from("test_slots")
    .select("title, start_time, duration_minutes, meeting_link, note")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle<Pick<TestSlotRow, "title" | "start_time" | "duration_minutes" | "meeting_link" | "note">>();

  if (!data) return null;

  return {
    title: data.title,
    startTime: data.start_time,
    durationMinutes: data.duration_minutes,
    meetingLink: data.meeting_link,
    note: data.note,
  };
}
