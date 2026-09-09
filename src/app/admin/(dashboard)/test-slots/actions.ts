"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateTestSlots() {
  revalidatePath("/admin/test-slots");
  revalidatePath("/student");
  revalidatePath("/student/test");
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

export type StudentTestSlotFormInput = {
  startTime: string; // "HH:MM" or "HH:MM:SS"
  meetingLink: string;
  note: string;
};

/**
 * Sets (or clears, if startTime is empty) one student's individually
 * assigned Friday test time — student_test_slots
 * (supabase/024_student_test_slots.sql), separate from the shared
 * test_slots table above.
 */
export async function setStudentTestSlot(
  studentId: string,
  input: StudentTestSlotFormInput
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!input.startTime) {
    const { error } = await supabase.from("student_test_slots").delete().eq("student_id", studentId);
    if (error) return { ok: false, error: error.message };
    revalidateTestSlots();
    return { ok: true };
  }

  const { error } = await supabase.from("student_test_slots").upsert(
    {
      student_id: studentId,
      start_time: input.startTime,
      meeting_link: input.meetingLink.trim() || null,
      note: input.note.trim() || null,
    },
    { onConflict: "student_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidateTestSlots();
  return { ok: true };
}
