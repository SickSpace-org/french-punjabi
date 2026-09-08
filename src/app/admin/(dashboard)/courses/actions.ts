"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityStatus } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateCourses() {
  revalidatePath("/courses");
  revalidatePath("/admin/courses");
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
    })
    .eq("id", batchId);

  if (error) return { ok: false, error: error.message };
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
  revalidateCourses();
  return { ok: true };
}

export async function setBatchActive(batchId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("batches").update({ is_active: isActive }).eq("id", batchId);

  if (error) return { ok: false, error: error.message };
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
  input: { meetingLink: string | null; classDays: number[] }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("batches")
    .update({ meeting_link: input.meetingLink || null, class_days: input.classDays })
    .eq("id", batchId);

  if (error) return { ok: false, error: error.message };
  revalidateCourses();
  revalidatePath("/admin/attendance");
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
