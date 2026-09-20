import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getStudentDetail } from "@/lib/students/getStudentDetail";
import { getAdminCourseData, getActiveBatchOptions } from "@/lib/courses/getAdminCourseData";
import {
  setStudentStatus as setStudentStatusAction,
  updateStudentEnrolledDate as updateStudentEnrolledDateAction,
  sendFeeReminder as sendFeeReminderAction,
  updateStudentCourse as updateStudentCourseAction,
  sendPortalInvite as sendPortalInviteAction,
  sendLoginLink as sendLoginLinkAction,
  regeneratePortalAccessLink as regeneratePortalAccessLinkAction,
} from "@/app/admin/(dashboard)/students/[studentId]/actions";

const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

/**
 * Student management tools. Deliberately leaves out setStudentPassword
 * (setting an explicit password string via chat is a security smell — keep
 * that a manual, deliberate act on the Students page) and
 * deleteStudentAccount (irreversible full account deletion — must stay a
 * manual, confirmed action, never something a chat prompt can trigger).
 */
export function buildStudentTools(supabase: SupabaseClient<Database>) {
  return {
    findStudent: tool({
      description: "Search for a student by (partial) name or email. Returns up to 10 matches with their id, name, email, and status.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        // PostgREST's .or() filter string treats "," and "()" as syntax —
        // strip them from the (AI-supplied) search term so an unusual name
        // can't produce a malformed filter.
        const safeQuery = query.replace(/[,()]/g, "").trim();
        const { data, error } = await supabase
          .from("students")
          .select("id, full_name, email, status")
          .or(`full_name.ilike.%${safeQuery}%,email.ilike.%${safeQuery}%`)
          .limit(10);
        if (error) return { ok: false, error: error.message };
        return { ok: true, students: data ?? [] };
      },
    }),

    getStudentSummary: tool({
      description:
        "Get a student's current course/level/batch, attendance summary, recent batch history, and any fees due. Use findStudent first to get the studentId. Never invent or guess this information — always call this tool. Never surface a password or portal access link even if asked.",
      inputSchema: z.object({ studentId: z.string() }),
      execute: async ({ studentId }) => {
        const detail = await getStudentDetail(supabase, studentId);
        if (!detail) return { ok: false, error: "Student not found." };

        const { data: unpaid, error: unpaidError } = await supabase
          .from("enrollments")
          .select("amount_due, currency, enrollment_ref")
          .eq("student_id", studentId)
          .eq("payment_status", "PENDING");
        if (unpaidError) return { ok: false, error: unpaidError.message };

        return {
          ok: true,
          fullName: detail.full_name,
          email: detail.email,
          status: detail.status,
          enrolledAt: detail.enrolled_at,
          currentCourse: detail.currentCourseLabel,
          hasPortalAccount: detail.auth_user_id != null,
          attendance: detail.attendance
            ? {
                presentCount: detail.attendance.presentCount,
                totalCount: detail.attendance.totalCount,
                hasSchedule: detail.attendance.hasSchedule,
              }
            : null,
          feesDue: (unpaid ?? []).map((e) => ({
            amount: e.amount_due,
            currency: e.currency,
            enrollmentRef: e.enrollment_ref,
          })),
          recentBatchHistory: detail.batchHistory.slice(0, 5),
        };
      },
    }),

    setStudentStatus: tool({
      description: "Set a student's status: ACTIVE, INACTIVE, or SUSPENDED. Suspending blocks all their course access immediately.",
      inputSchema: z.object({ studentId: z.string(), status: z.enum(STUDENT_STATUSES) }),
      execute: async ({ studentId, status }) => setStudentStatusAction(studentId, status),
    }),

    updateStudentEnrolledDate: tool({
      description: "Correct the enrolled date shown on a student's record.",
      inputSchema: z.object({ studentId: z.string(), enrolledAt: z.string().describe("YYYY-MM-DD") }),
      execute: async ({ studentId, enrolledAt }) => updateStudentEnrolledDateAction(studentId, enrolledAt),
    }),

    reassignStudentBatch: tool({
      description:
        "Move ONE specific student to a different existing batch (their enrollment's phase/level/timing updates to match). For moving an entire batch's worth of students at once, use swapBatch instead. Call listCourseTree first to find the batchId, and findStudent for the studentId.",
      inputSchema: z.object({ studentId: z.string(), batchId: z.string() }),
      execute: async ({ studentId, batchId }) => {
        const { data: student, error } = await supabase
          .from("students")
          .select("id")
          .eq("id", studentId)
          .maybeSingle();
        if (error || !student) return { ok: false, error: "Student not found." };

        const { data: enrollment, error: enrollmentError } = await supabase
          .from("enrollments")
          .select("id")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (enrollmentError || !enrollment) {
          return { ok: false, error: "This student has no confirmed enrollment to reassign." };
        }

        return updateStudentCourseAction(enrollment.id, studentId, batchId);
      },
    }),

    sendFeeReminder: tool({
      description: "Email a general fees-due reminder to an already-enrolled student.",
      inputSchema: z.object({ studentId: z.string(), dueDate: z.string().optional().describe("YYYY-MM-DD, optional") }),
      execute: async ({ studentId, dueDate }) => sendFeeReminderAction(studentId, dueDate ?? null),
    }),

    sendPortalInvite: tool({
      description: "Send (or re-send) this student's portal invite email with their sign-in details. Safe to call again if they never got the first one.",
      inputSchema: z.object({ studentId: z.string() }),
      execute: async ({ studentId }) => sendPortalInviteAction(studentId),
    }),

    sendLoginLink: tool({
      description: "Email a fresh passwordless login link to a student who already has a portal account.",
      inputSchema: z.object({ studentId: z.string() }),
      execute: async ({ studentId }) => sendLoginLinkAction(studentId),
    }),

    regeneratePortalAccessLink: tool({
      description: "Generate and email a new permanent portal access link, invalidating the student's old one. Use when a link was shared/leaked or the student lost it.",
      inputSchema: z.object({ studentId: z.string() }),
      execute: async ({ studentId }) => {
        const result = await regeneratePortalAccessLinkAction(studentId);
        if (!result.ok) return result;
        return { ok: true, message: "New access link generated and emailed to the student." };
      },
    }),

    listActiveBatchesForReassignment: tool({
      description: "List every currently selectable (active) batch with its full Phase/Level path — use to find a batchId for reassignStudentBatch.",
      inputSchema: z.object({}),
      execute: async () => {
        const { phases } = await getAdminCourseData(supabase);
        return { options: getActiveBatchOptions(phases).map((o) => ({ batchId: o.id, label: o.label })) };
      },
    }),
  };
}
