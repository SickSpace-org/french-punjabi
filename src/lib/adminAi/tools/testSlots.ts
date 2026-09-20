import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  createTestSlot as createTestSlotAction,
  updateTestSlot as updateTestSlotAction,
  setTestSlotActive as setTestSlotActiveAction,
  deleteTestSlot as deleteTestSlotAction,
  setStudentTestSlot as setStudentTestSlotAction,
} from "@/app/admin/(dashboard)/test-slots/actions";

/** Mock-test scheduling tools — everything under the admin Test Slots page. */
export function buildTestSlotTools(supabase: SupabaseClient<Database>) {
  return {
    listTestSlots: tool({
      description: "List every shared test slot (id, title, time, active state) — call before editing/deleting one.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase
          .from("test_slots")
          .select("id, title, start_time, duration_minutes, is_active")
          .order("start_time");
        if (error) return { ok: false, error: error.message };
        return { ok: true, slots: data ?? [] };
      },
    }),

    createTestSlot: tool({
      description: "Create a new shared Friday mock-test slot.",
      inputSchema: z.object({
        title: z.string().default("Mock Test"),
        startTime: z.string().describe("HH:MM or HH:MM:SS, local time"),
        durationMinutes: z.number().int().positive(),
        meetingLink: z.string().optional(),
        note: z.string().optional(),
      }),
      execute: async (input) =>
        createTestSlotAction({
          title: input.title,
          startTime: input.startTime,
          durationMinutes: input.durationMinutes,
          meetingLink: input.meetingLink ?? "",
          note: input.note ?? "",
        }),
    }),

    editTestSlot: tool({
      description: "Edit an existing shared test slot's title/time/duration/link/note. Call listTestSlots first to get the slotId.",
      inputSchema: z.object({
        slotId: z.string(),
        title: z.string().optional(),
        startTime: z.string().optional(),
        durationMinutes: z.number().int().positive().optional(),
        meetingLink: z.string().optional(),
        note: z.string().optional(),
      }),
      execute: async ({ slotId, ...fields }) => {
        const { data: current, error } = await supabase
          .from("test_slots")
          .select("title, start_time, duration_minutes, meeting_link, note")
          .eq("id", slotId)
          .maybeSingle();
        if (error || !current) return { ok: false, error: "Test slot not found." };
        return updateTestSlotAction(slotId, {
          title: fields.title ?? current.title,
          startTime: fields.startTime ?? current.start_time,
          durationMinutes: fields.durationMinutes ?? current.duration_minutes,
          meetingLink: fields.meetingLink ?? current.meeting_link ?? "",
          note: fields.note ?? current.note ?? "",
        });
      },
    }),

    setTestSlotActive: tool({
      description: "Activate or deactivate a shared test slot.",
      inputSchema: z.object({ slotId: z.string(), isActive: z.boolean() }),
      execute: async ({ slotId, isActive }) => setTestSlotActiveAction(slotId, isActive),
    }),

    deleteTestSlot: tool({
      description: "Permanently delete a shared test slot.",
      inputSchema: z.object({ slotId: z.string() }),
      execute: async ({ slotId }) => deleteTestSlotAction(slotId),
    }),

    setStudentTestSlot: tool({
      description: "Set (or clear, by omitting startTime) one student's individually assigned Friday test time. Call findStudent first to get the studentId.",
      inputSchema: z.object({
        studentId: z.string(),
        startTime: z.string().optional().describe("HH:MM or HH:MM:SS — omit to clear their assigned slot"),
        meetingLink: z.string().optional(),
        note: z.string().optional(),
      }),
      execute: async ({ studentId, startTime, meetingLink, note }) =>
        setStudentTestSlotAction(studentId, {
          startTime: startTime ?? "",
          meetingLink: meetingLink ?? "",
          note: note ?? "",
        }),
    }),
  };
}
