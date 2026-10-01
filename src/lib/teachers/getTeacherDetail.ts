import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TeacherContentAuditRow, TeacherHoursRow, TeacherPaymentRow, TeacherRow } from "@/types/database";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { formatBatchTiming, formatCourseLabel } from "@/lib/courses/batchLabel";

export type TeacherContentAuditEntry = TeacherContentAuditRow & {
  /** Resolved from the batch tree when still resolvable; falls back to a generic label for a since-deleted batch (audit rows are never dropped just because the batch they reference is gone). */
  batchLabel: string;
};

export type TeacherDetail = TeacherRow & {
  assignedBatches: { batchId: string; label: string }[];
  /** Active batches with no teacher assigned yet — options for the "assign a batch" picker on this page. */
  unassignedBatches: { batchId: string; label: string }[];
  /** Admin-only — same reasoning as StudentDetail.portalPassword (see supabase/011_student_portal_credentials.sql / 029_teachers.sql): a separate table with no self-select policy, so a teacher's own session can never read this back. */
  portalPassword: string | null;
  /** Admin-only bookkeeping — never fetched or shown anywhere a teacher's own session could reach (see supabase/029_teachers.sql, no self-select policy exists on either table). */
  payments: TeacherPaymentRow[];
  hours: TeacherHoursRow[];
  /** Permanent record of every recording/material this teacher created, edited, or deleted, across all their batches — see supabase/034_teacher_recordings.sql. Newest first. */
  contentAudit: TeacherContentAuditEntry[];
};

/**
 * Full detail for one teacher's admin page: profile, every batch currently
 * assigned to them, and their full payments/hours bookkeeping history.
 * This function is only ever called from admin-only server code (the
 * Teachers detail page/actions) — RLS on teacher_payments/teacher_hours
 * would refuse these two selects for any non-admin session regardless.
 */
export async function getTeacherDetail(
  supabase: SupabaseClient<Database>,
  teacherId: string
): Promise<TeacherDetail | null> {
  const [teacherResult, credentialResult, paymentsResult, hoursResult, auditResult, courseData] = await Promise.all([
    supabase.from("teachers").select("*").eq("id", teacherId).maybeSingle(),
    supabase.from("teacher_portal_credentials").select("password").eq("teacher_id", teacherId).maybeSingle(),
    supabase
      .from("teacher_payments")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("paid_at", { ascending: false }),
    supabase
      .from("teacher_hours")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("week_start", { ascending: false }),
    supabase
      .from("teacher_content_audit")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false }),
    getAdminCourseData(supabase),
  ]);

  if (teacherResult.error) throw teacherResult.error;
  if (!teacherResult.data) return null;
  if (paymentsResult.error) throw paymentsResult.error;
  if (hoursResult.error) throw hoursResult.error;
  if (auditResult.error) throw auditResult.error;

  const assignedBatches: { batchId: string; label: string }[] = [];
  const unassignedBatches: { batchId: string; label: string }[] = [];
  // Covers every batch regardless of is_active — an audit entry must stay
  // readable even after the batch it happened on is later archived.
  const allBatchLabelById = new Map<string, string>();
  for (const phase of courseData.phases) {
    for (const batch of phase.batches) {
      const label = `${phase.title} — ${formatBatchTiming(batch)}`;
      allBatchLabelById.set(batch.id, label);
      if (!phase.is_active || !batch.is_active) continue;
      if (batch.teacher_id === teacherId) assignedBatches.push({ batchId: batch.id, label });
      else if (!batch.teacher_id) unassignedBatches.push({ batchId: batch.id, label });
    }
    for (const level of phase.levels) {
      for (const batch of level.batches) {
        const label = formatCourseLabel(phase.title, level.name, formatBatchTiming(batch));
        allBatchLabelById.set(batch.id, label);
        if (!phase.is_active || !level.is_active || !batch.is_active) continue;
        if (batch.teacher_id === teacherId) assignedBatches.push({ batchId: batch.id, label });
        else if (!batch.teacher_id) unassignedBatches.push({ batchId: batch.id, label });
      }
    }
  }

  const contentAudit: TeacherContentAuditEntry[] = (auditResult.data ?? []).map((entry) => ({
    ...entry,
    batchLabel: allBatchLabelById.get(entry.batch_id) ?? "Deleted batch",
  }));

  return {
    ...teacherResult.data,
    assignedBatches,
    unassignedBatches,
    portalPassword: credentialResult.data?.password ?? null,
    payments: paymentsResult.data ?? [],
    hours: hoursResult.data ?? [],
    contentAudit,
  };
}
