import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { getAdminStudents } from "@/lib/courses/getAdminStudents";
import { formatBatchTiming, formatCourseLabel } from "@/lib/courses/batchLabel";

export type AdminMessageBatchOption = { batchId: string; label: string };
export type AdminMessageStudentOption = { studentId: string; fullName: string; currentBatchId: string | null };

export type AdminSentMessageRecipient = { studentId: string; fullName: string; isRead: boolean };

export type AdminSentMessage = {
  broadcastId: string;
  batchId: string;
  batchLabel: string;
  body: string;
  createdAt: string;
  recipients: AdminSentMessageRecipient[];
};

export type AdminMessagesData = {
  /** Active batches only — what admin can pick to send a NEW message into. */
  batches: AdminMessageBatchOption[];
  /** Every student, with their current batch (per the "most recent enrollment with a batch_id" convention) — the picker filters this to the selected batch client-side. */
  students: AdminMessageStudentOption[];
  /** Newest first, across every batch — admin isn't scoped to one batch the way a teacher's dashboard is. */
  sentMessages: AdminSentMessage[];
};

/**
 * Admin's own "send a batch-wide message" page — see
 * supabase/038_admin_messages.sql. Mirrors getTeacherDashboard.ts's shape
 * (batch picker + roster + sent-messages list) but admin isn't scoped to
 * any one batch, so this fetches ALL active batches as send targets
 * (reusing getAdminCourseData, the same tree getTeacherDetail.ts already
 * flattens) and ALL students (reusing getAdminStudents, which already
 * computes current_batch_id per the "current batch" convention) rather
 * than a single teacher_batch_roster() call, which would always fail
 * batch_owned_by_current_teacher() for a non-teacher admin session.
 */
export async function getAdminMessagesData(supabase: SupabaseClient<Database>): Promise<AdminMessagesData> {
  const [courseData, students] = await Promise.all([getAdminCourseData(supabase), getAdminStudents(supabase)]);

  const batches: AdminMessageBatchOption[] = [];
  // Covers every batch regardless of is_active — same reasoning as
  // getTeacherDetail.ts's allBatchLabelById: an old sent message must stay
  // readable by batch name even after that batch is later archived, even
  // though archived batches aren't offered as a target for a NEW message.
  const allBatchLabelById = new Map<string, string>();
  for (const phase of courseData.phases) {
    for (const batch of phase.batches) {
      const label = `${phase.title} — ${formatBatchTiming(batch)}`;
      allBatchLabelById.set(batch.id, label);
      if (phase.is_active && batch.is_active) batches.push({ batchId: batch.id, label });
    }
    for (const level of phase.levels) {
      for (const batch of level.batches) {
        const label = formatCourseLabel(phase.title, level.name, formatBatchTiming(batch));
        allBatchLabelById.set(batch.id, label);
        if (phase.is_active && level.is_active && batch.is_active) batches.push({ batchId: batch.id, label });
      }
    }
  }

  const studentOptions: AdminMessageStudentOption[] = students.map((s) => ({
    studentId: s.id,
    fullName: s.full_name,
    currentBatchId: s.current_batch_id,
  }));
  const nameByStudentId = new Map(studentOptions.map((s) => [s.studentId, s.fullName]));

  const { data: messageRows, error } = await supabase
    .from("teacher_messages")
    .select("broadcast_id, batch_id, student_id, body, is_read, created_at")
    .eq("is_admin_message", true)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const messagesByBroadcast = new Map<string, AdminSentMessage>();
  for (const m of messageRows ?? []) {
    let group = messagesByBroadcast.get(m.broadcast_id);
    if (!group) {
      group = {
        broadcastId: m.broadcast_id,
        batchId: m.batch_id,
        batchLabel: allBatchLabelById.get(m.batch_id) ?? "Deleted batch",
        body: m.body,
        createdAt: m.created_at,
        recipients: [],
      };
      messagesByBroadcast.set(m.broadcast_id, group);
    }
    group.recipients.push({
      studentId: m.student_id,
      fullName: nameByStudentId.get(m.student_id) ?? "Former student",
      isRead: m.is_read,
    });
  }

  return {
    batches,
    students: studentOptions,
    sentMessages: Array.from(messagesByBroadcast.values()),
  };
}
