"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateTestSlots() {
  revalidatePath("/admin/test-slots");
  revalidatePath("/student");
}

export type TestSlotFormInput = {
  title: string;
  startTime: string; // "HH:MM" or "HH:MM:SS"
  durationMinutes: number;
  meetingLink: string;
  note: string;
};

export async function createTestSlot(input: TestSlotFormInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("test_slots").insert({
    title: input.title || "Mock Test",
    start_time: input.startTime,
    duration_minutes: input.durationMinutes,
    meeting_link: input.meetingLink.trim() || null,
    note: input.note.trim() || null,
    is_active: true,
  });

  if (error) return { ok: false, error: error.message };
  revalidateTestSlots();
  return { ok: true };
}

export async function updateTestSlot(slotId: string, input: TestSlotFormInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("test_slots")
    .update({
      title: input.title || "Mock Test",
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      meeting_link: input.meetingLink.trim() || null,
      note: input.note.trim() || null,
    })
    .eq("id", slotId);

  if (error) return { ok: false, error: error.message };
  revalidateTestSlots();
  return { ok: true };
}

export async function setTestSlotActive(slotId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("test_slots").update({ is_active: isActive }).eq("id", slotId);

  if (error) return { ok: false, error: error.message };
  revalidateTestSlots();
  return { ok: true };
}

export async function deleteTestSlot(slotId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("test_slots").delete().eq("id", slotId);

  if (error) return { ok: false, error: error.message };
  revalidateTestSlots();
  return { ok: true };
}
