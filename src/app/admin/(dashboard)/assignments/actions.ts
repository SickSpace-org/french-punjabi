"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENTS_BUCKET } from "@/lib/assignments/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Relies on Supabase RLS (public.is_admin(), see supabase/066_assignments.sql)
 * as the real authorization boundary — a non-admin session's reads and
 * writes are rejected by the database regardless of this file.
 */

function revalidateAssignments() {
  revalidatePath("/admin/assignments");
  revalidatePath("/student/assignments");
}

export type AssignmentInput = {
  title: string;
  note: string;
  batchId: string | null;
  storagePath: string;
  fileName: string;
};

/** Saves the row for a PDF the admin's browser already uploaded to Storage. */
export async function createAssignment(input: AssignmentInput): Promise<ActionResult> {
  const supabase = await createClient();
  const title = input.title.trim() || input.fileName;

  if (!input.storagePath.startsWith("tasks/")) return { ok: false, error: "Invalid file path." };

  const { error } = await supabase.from("assignments").insert({
    title: title.slice(0, 200),
    note: input.note.trim().slice(0, 2000) || null,
    batch_id: input.batchId,
    storage_path: input.storagePath,
    file_name: input.fileName.slice(0, 200),
  });

  if (error) {
    await supabase.storage.from(ASSIGNMENTS_BUCKET).remove([input.storagePath]);
    return { ok: false, error: "Couldn't save the assignment. Please try again." };
  }
  revalidateAssignments();
  return { ok: true };
}

/**
 * Removes an assignment now instead of waiting for it to expire. Work
 * students already submitted for it stays (until its own 3 days are up),
 * still labelled with the assignment's title.
 */
export async function deleteAssignment(assignmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId)
    .select("storage_path")
    .maybeSingle();
  if (error || !row) return { ok: false, error: "Couldn't delete this assignment." };

  await supabase.storage.from(ASSIGNMENTS_BUCKET).remove([row.storage_path]);
  revalidateAssignments();
  return { ok: true };
}

export async function deleteSubmissionAsAdmin(submissionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("assignment_submissions")
    .delete()
    .eq("id", submissionId)
    .select("storage_path")
    .maybeSingle();

  if (error || !row) return { ok: false, error: "Couldn't delete this submission." };
  await supabase.storage.from(ASSIGNMENTS_BUCKET).remove([row.storage_path]);
  revalidateAssignments();
  return { ok: true };
}

export async function setSubmissionReviewed(submissionId: string, reviewed: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("assignment_submissions")
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null }, { count: "exact" })
    .eq("id", submissionId);

  if (error || !count) return { ok: false, error: "Couldn't update this submission." };
  revalidateAssignments();
  return { ok: true };
}
