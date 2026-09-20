import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  updateEnrollmentStatus as updateEnrollmentStatusAction,
  confirmEnrollmentPayment as confirmEnrollmentPaymentAction,
  sendPaymentReminder as sendPaymentReminderAction,
  sendPaymentReminderBulk as sendPaymentReminderBulkAction,
} from "@/app/admin/(dashboard)/enrollments/actions";

const ENROLLMENT_STATUSES = ["NEW", "CONTACTED", "ENROLLED"] as const;

/** Enrollment application tools — everything under the admin Enrollments page. */
export function buildEnrollmentTools(supabase: SupabaseClient<Database>) {
  return {
    findEnrollment: tool({
      description:
        "Search enrollment applications by (partial) name, email, or enrollment reference (e.g. 'FP-2026-A7K4P2'). Returns up to 10 matches with id, name, email, status, payment status, amount due, and course chosen.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const safeQuery = query.replace(/[,()]/g, "").trim();
        const { data, error } = await supabase
          .from("enrollments")
          .select("id, full_name, email, enrollment_ref, status, payment_status, amount_due, currency, phase_name, level_name, batch_timing, created_at")
          .or(
            `full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%,enrollment_ref.ilike.%${safeQuery}%`
          )
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) return { ok: false, error: error.message };
        return { ok: true, enrollments: data ?? [] };
      },
    }),

    updateEnrollmentStatus: tool({
      description: "Change an enrollment application's status: NEW, CONTACTED, or ENROLLED. Call findEnrollment first to get the enrollmentId.",
      inputSchema: z.object({ enrollmentId: z.string(), status: z.enum(ENROLLMENT_STATUSES) }),
      execute: async ({ enrollmentId, status }) => updateEnrollmentStatusAction(enrollmentId, status),
    }),

    confirmEnrollmentPayment: tool({
      description:
        "Confirm that this enrollment's payment (Interac e-Transfer) has arrived — the ONLY way to mark an enrollment PAID. Creates/links the student's account and emails their confirmation automatically. Only do this when the admin has explicitly confirmed the money arrived. Call findEnrollment first to get the enrollmentId.",
      inputSchema: z.object({ enrollmentId: z.string() }),
      execute: async ({ enrollmentId }) => confirmEnrollmentPaymentAction(enrollmentId),
    }),

    sendPaymentReminder: tool({
      description: "Email a payment reminder for one still-unpaid enrollment application.",
      inputSchema: z.object({ enrollmentId: z.string() }),
      execute: async ({ enrollmentId }) => sendPaymentReminderAction(enrollmentId),
    }),

    sendPaymentReminderBulk: tool({
      description: "Email a payment reminder to EVERY currently-unpaid enrollment application at once. Confirm with the admin before calling this — it's a bulk send.",
      inputSchema: z.object({ confirm: z.boolean().describe("Must be true — the admin explicitly asked to send to everyone.") }),
      execute: async ({ confirm }) => {
        if (!confirm) return { ok: false, error: "Not confirmed." };
        return sendPaymentReminderBulkAction();
      },
    }),
  };
}
