"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SELF_STUDY_BUCKET } from "@/lib/selfStudy/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Relies on Supabase RLS (public.is_admin(), see supabase/065_self_study.sql)
 * as the real authorization boundary — a non-admin session's reads and
 * writes are rejected by the database regardless of this file.
 */

function revalidateSelfStudy() {
  revalidatePath("/admin/self-study");
  revalidatePath("/student/self-study");
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

  if (!input.storagePath.startsWith("assignments/")) return { ok: false, error: "Invalid file path." };

  const { error } = await supabase.from("self_study_assignments").insert({
    title: title.slice(0, 200),
    note: input.note.trim().slice(0, 2000) || null,
    batch_id: input.batchId,
    storage_path: input.storagePath,
    file_name: input.fileName.slice(0, 200),
  });

  if (error) {
    await supabase.storage.from(SELF_STUDY_BUCKET).remove([input.storagePath]);
    return { ok: false, error: "Couldn't save the homework. Please try again." };
  }
  revalidateSelfStudy();
  return { ok: true };
}

/** Removes a homework file now instead of waiting for it to expire. */
export async function deleteAssignment(assignmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("self_study_assignments")
    .delete()
    .eq("id", assignmentId)
    .select("storage_path")
    .maybeSingle();

  if (error || !row) return { ok: false, error: "Couldn't delete this homework." };
  await supabase.storage.from(SELF_STUDY_BUCKET).remove([row.storage_path]);
  revalidateSelfStudy();
  return { ok: true };
}

export async function deleteSubmissionAsAdmin(submissionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("self_study_submissions")
    .delete()
    .eq("id", submissionId)
    .select("storage_path")
    .maybeSingle();

  if (error || !row) return { ok: false, error: "Couldn't delete this submission." };
  await supabase.storage.from(SELF_STUDY_BUCKET).remove([row.storage_path]);
  revalidateSelfStudy();
  return { ok: true };
}

export async function setSubmissionReviewed(submissionId: string, reviewed: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("self_study_submissions")
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null }, { count: "exact" })
    .eq("id", submissionId);

  if (error || !count) return { ok: false, error: "Couldn't update this submission." };
  revalidateSelfStudy();
  return { ok: true };
}
