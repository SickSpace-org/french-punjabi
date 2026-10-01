"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseTimeLabelToClockTime } from "@/lib/attendance/schedule";
import { notifyWaitlistIfSeatOpen } from "@/lib/enrollment/waitlistNotify";
import type { AvailabilityStatus } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateCourses() {
  revalidatePath("/courses");
  revalidatePath("/admin/courses");
  // Batch teacher assignment is shown on both of these too.
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/teachers");
}

/**
 * Every mutation below relies on Supabase RLS (public.is_admin(), see
 * supabase/001_schema.sql) as the real authorization boundary — the
 * server client here carries the caller's session, so a non-admin session
 * has its writes silently rejected by the database regardless of what this
 * file does.
 */

export async function updatePhaseText(
  phaseId: string,
  input: { title: string; code: string; monthsLabel: string; badge: string; description: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("phases")
    .update({
      title: input.title,
      code: input.code,
      months_label: input.monthsLabel,
      badge: input.badge || null,
      description: input.description,
    })
    .eq("id", phaseId);

  if (error) return { ok: false, error: error.message };
  revalidateCourses();
  return { ok: true };
}

export async function updateLevelText(
  levelId: string,
  input: { name: string; subtitle: string; teacherName: string }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("levels")
    .update({
      name: input.name,
      subtitle: input.subtitle || null,
      teacher_name: input.teacherName || null,
    })
    .eq("id", levelId);

  if (error) return { ok: false, error: error.message };
  revalidateCourses();
  return { ok: true };
}

export type BatchFormInput = {
  name: string;
  teacherName: string;
  timeLabel: string;
  timezone: string;
  note: string;
  isTbd: boolean;
  availabilityStatus: AvailabilityStatus;
  totalSlots: number | null;
  filledSlots: number;
  displayOrder: number;
  /** The real, logged-in teacher account assigned to this batch (see supabase/029_teachers.sql) — distinct from teacherName above, which is just a free-text display label. Null to unassign. */
  teacherId: string | null;
};

export async function createBatch(
  parent: { phaseId: string } | { levelId: string },
  input: BatchFormInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("batches").insert({
    phase_id: "phaseId" in parent ? parent.phaseId : null,
    level_id: "levelId" in parent ? parent.levelId : null,
    name: input.name || null,
    teacher_name: input.teacherName || null,
    time_label: input.timeLabel,
    timezone: input.timezone,
    note: input.note || null,
    is_tbd: input.isTbd,
    availability_status: input.availabilityStatus,
    total_slots: input.totalSlots,
    filled_slots: input.filledSlots,
    display_order: input.displayOrder,
    is_active: true,
    teacher_id: input.teacherId,
    // Best-effort default for the attendance check-in window — the admin
    // can still fine-tune it on the Attendance page. updateBatch below
    // deliberately does NOT touch this on edits, so it never clobbers a
    // value the admin has since set there.
    class_time: parseTimeLabelToClockTime(input.timeLabel),
  });

  if (error) return { ok: false, error: error.message };
  revalidateCourses();
  return { ok: true };
}

export async function updateBatch(batchId: string, input: BatchFormInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("batches")
    .update({
      name: input.name || null,
      teacher_name: input.teacherName || null,
      time_label: input.timeLabel,
      timezone: input.timezone,
      note: input.note || null,
      is_tbd: input.isTbd,
      availability_status: input.availabilityStatus,
      total_slots: input.totalSlots,
      filled_slots: input.filledSlots,
      display_order: input.displayOrder,
      teacher_id: input.teacherId,
    })
    .eq("id", batchId);

  if (error) return { ok: false, error: error.message };
  await notifyWaitlistIfSeatOpen(supabase, batchId);
  revalidateCourses();
  return { ok: true };
}

export async function updateBatchSlots(
  batchId: string,
  input: { totalSlots: number | null; filledSlots: number }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("batches")
    .update({ total_slots: input.totalSlots, filled_slots: input.filledSlots })
    .eq("id", batchId);

  if (error) return { ok: false, error: error.message };
  await notifyWaitlistIfSeatOpen(supabase, batchId);
  revalidateCourses();
  return { ok: true };
}

export async function updateBatchStatus(
  batchId: string,
  status: AvailabilityStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("batches")
    .update({ availability_status: status })
    .eq("id", batchId);

  if (error) return { ok: false, error: error.message };
  await notifyWaitlistIfSeatOpen(supabase, batchId);
  revalidateCourses();
  return { ok: true };
}

/**
 * Narrow assign/unassign — touches only teacher_id, unlike updateBatch
 * (which needs the whole BatchFormInput). Used by the Teacher detail
 * page's "assign a batch" picker, in addition to the full Assigned
 * Teacher field on BatchFormModal (Courses page). Both ultimately write
 * the same column, so a change from either place is immediately visible
 * in both, and instantly moves the batch's roster into/out of the
 * relevant teacher's portal view (RLS is keyed off batches.teacher_id —
 * see supabase/030_teacher_batch_access.sql).
 */
export async function assignBatchTeacher(batchId: string, teacherId: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("batches").update({ teacher_id: teacherId }).eq("id", batchId);

  if (error) return { ok: false, error: error.message };
  revalidateCourses();
  return { ok: true };
}

export async function setBatchActive(batchId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("batches").update({ is_active: isActive }).eq("id", batchId);

  if (error) return { ok: false, error: error.message };
  await notifyWaitlistIfSeatOpen(supabase, batchId);
  revalidateCourses();
  return { ok: true };
}

/**
 * Sets this batch's class meeting link and which weekdays it meets — read
 * by mark_class_attendance() (supabase/016_attendance.sql) to decide
 * whether a student's "Join Class" click counts as today's Present, and by
 * getAdminAttendance.ts to build the admin's attendance grid.
 */
export async function updateBatchAttendanceConfig(
  batchId: string,
  input: { meetingLink: string | null; classDays: number[]; classTime: string | null }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("batches")
    .update({
      meeting_link: input.meetingLink || null,
      class_days: input.classDays,
      class_time: input.classTime || null,
    })
    .eq("id", batchId);

  if (error) return { ok: false, error: error.message };
  revalidateCourses();
  revalidatePath("/admin/attendance");
  revalidatePath("/student/attendance");
  return { ok: true };
}

/**
 * Manual attendance override — Present is just "a row exists for this
 * student/batch/date" (see supabase/016_attendance.sql), so marking
 * Present is an upsert and marking Absent is a delete; there's no
 * separate status flag. Used by BOTH admins and teachers (see
 * AttendanceDateGrid, src/components/shared/AttendanceDateGrid.tsx) —
 * this function has no app-level role check of its own, exactly as
 * before; RLS (attendance_admin_write, 019_attendance_time_window_and_admin_override.sql
 * + attendance_teacher_write, 033_teacher_attendance_access.sql) is what
 * actually decides whether the caller's session may write this row, same
 * "RLS is the real boundary" philosophy used everywhere else. Unlike a
 * student's own check-in, which only ever goes through the
 * security-definer mark_class_attendance() RPC.
 */
export async function setAttendanceStatus(
  studentId: string,
  batchId: string,
  classDate: string,
  present: boolean
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = present
    ? await supabase
        .from("attendance")
        .upsert(
          { student_id: studentId, batch_id: batchId, class_date: classDate },
          { onConflict: "student_id,batch_id,class_date" }
        )
    : await supabase
        .from("attendance")
        .delete()
        .eq("student_id", studentId)
        .eq("batch_id", batchId)
        .eq("class_date", classDate);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/attendance");
  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/student/attendance");
  revalidatePath("/teacher/attendance");
  return { ok: true };
}

export type PricingFormInput = {
  basePrice: number;
  taxRate: number;
  displayTotal: number;
  durationLabel: string;
};

export async function updatePricing(
  pricingId: string,
  input: PricingFormInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pricing")
    .update({
      base_price: input.basePrice,
      tax_rate: input.taxRate,
      display_total: input.displayTotal,
      duration_label: input.durationLabel || null,
    })
    .eq("id", pricingId);

  if (error) return { ok: false, error: error.message };
  revalidateCourses();
  return { ok: true };
}

export type ProgramOfferFormInput = {
  label: string;
  basePrice: number;
  taxRate: number;
  displayTotal: number;
  durationLabel: string;
};

export async function updateProgramOffer(
  offerId: string,
  input: ProgramOfferFormInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("program_offers")
    .update({
      label: input.label,
      base_price: input.basePrice,
      tax_rate: input.taxRate,
      display_total: input.displayTotal,
      duration_label: input.durationLabel || null,
    })
    .eq("id", offerId);

  if (error) return { ok: false, error: error.message };
  revalidateCourses();
  return { ok: true };
}
