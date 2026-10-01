"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Every action here relies entirely on RLS/the underlying RPC's own
 * ownership check (batch_owned_by_current_teacher(), see
 * supabase/033_teacher_attendance_access.sql / 034_teacher_recordings.sql)
 * as the real authorization boundary — same "app code is only UX"
 * philosophy used everywhere else in this codebase. None of these RPCs
 * can succeed for a batch that isn't the caller's own, regardless of what
 * batchId/recordingId this file is passed.
 */

export async function updateBatchMeetingLink(batchId: string, meetingLink: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_update_meeting_link", {
    p_batch_id: batchId,
    p_meeting_link: meetingLink.trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  return { ok: true };
}

export type AddRecordingInput = { url: string; title: string; classDate: string };

export async function addClassRecording(batchId: string, input: AddRecordingInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_add_recording", {
    p_batch_id: batchId,
    p_url: input.url.trim(),
    p_title: input.title.trim() || null,
    p_class_date: input.classDate || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

export async function updateClassRecording(recordingId: string, input: AddRecordingInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_update_recording", {
    p_recording_id: recordingId,
    p_url: input.url.trim(),
    p_title: input.title.trim() || null,
    p_class_date: input.classDate || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

export async function deleteClassRecording(recordingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_delete_recording", { p_recording_id: recordingId });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

/**
 * Called AFTER the file itself has already been uploaded client-side
 * directly to the batch-materials Storage bucket (gated by
 * batch_materials_storage_teacher_all, supabase/035_batch_materials.sql —
 * there is no RPC-mediated upload path for raw file bytes). This just
 * records the metadata row + audit entry via teacher_add_material(),
 * which independently re-checks batch ownership and that storagePath
 * actually belongs to batchId.
 */
export async function addBatchMaterial(batchId: string, storagePath: string, title: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_add_material", {
    p_batch_id: batchId,
    p_storage_path: storagePath,
    p_title: title.trim(),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

export async function renameBatchMaterial(materialId: string, title: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_update_material", {
    p_material_id: materialId,
    p_title: title.trim(),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

/**
 * Removes the underlying Storage object (via this same RLS-scoped session
 * — batch_materials_storage_teacher_all gates it, same as the upload
 * itself) and THEN the metadata row + audit entry via
 * teacher_delete_material(). If the storage removal fails, the metadata
 * row is deliberately left in place rather than deleted out from under a
 * file that's still there — the caller sees the real error either way.
 */
export async function deleteBatchMaterial(materialId: string, storagePath: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: storageError } = await supabase.storage.from("batch-materials").remove([storagePath]);
  if (storageError) return { ok: false, error: storageError.message };

  const { error } = await supabase.rpc("teacher_delete_material", { p_material_id: materialId });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

/**
 * studentId null = whole-batch announcement. teacher_send_message()
 * (supabase/036_teacher_messages.sql) independently re-verifies batch
 * ownership AND, for an individual send, that studentId is actually in
 * that batch's current roster — a tampered studentId from an unrelated
 * batch is rejected by the function itself, not just hidden by this UI.
 * Messages are permanent once sent: there is no update/delete RPC for
 * this table, by deliberate design for this phase.
 */
export async function sendTeacherMessage(batchId: string, studentId: string | null, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a message first." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_send_message", {
    p_batch_id: batchId,
    p_student_id: studentId,
    p_body: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

/**
 * A private, per-student note — never shared with the rest of the batch
 * (contrast with sendTeacherMessage's whole-batch option). teacher_add_
 * feedback_note() (supabase/037_student_feedback_notes.sql) independently
 * re-verifies batch ownership AND that studentId is actually in that
 * batch's current roster, same as the individual-send path for messages.
 */
export async function addFeedbackNote(batchId: string, studentId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a note first." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_add_feedback_note", {
    p_batch_id: batchId,
    p_student_id: studentId,
    p_body: trimmed,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

export async function updateFeedbackNote(noteId: string, body: string): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Please write a note first." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_update_feedback_note", { p_note_id: noteId, p_body: trimmed });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}

/**
 * Deletes the whole thread — any student reply on this note cascades away
 * with it at the database level (parent_note_id is ON DELETE CASCADE).
 */
export async function deleteFeedbackNote(noteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("teacher_delete_feedback_note", { p_note_id: noteId });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher");
  revalidatePath("/student");
  return { ok: true };
}
