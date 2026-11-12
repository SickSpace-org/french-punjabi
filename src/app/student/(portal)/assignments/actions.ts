"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { ASSIGNMENTS_BUCKET } from "@/lib/assignments/constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SubmissionInput = {
  assignmentId: string;
  note: string;
  storagePath: string;
  fileName: string;
};

function revalidateAssignments() {
  revalidatePath("/student/assignments");
  revalidatePath("/admin/assignments");
}

/**
 * Saves the row for a PDF the student's browser already uploaded to their
 * own submissions/{studentId}/ folder. RLS (assignment_submissions_student_insert)
 * independently re-checks that the row, the path and the assignment all
 * belong to the caller. If the row can't be saved, the uploaded file is
 * removed again so nothing is left behind.
 */
export async function submitAssignment(input: SubmissionInput): Promise<ActionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student || student.status !== "ACTIVE") return { ok: false, error: "Not signed in." };

  const ownPrefix = `submissions/${student.id}/`;
  if (!input.storagePath.startsWith(ownPrefix)) return { ok: false, error: "Invalid file path." };

  const { error } = await supabase.from("assignment_submissions").insert({
    assignment_id: input.assignmentId,
    student_id: student.id,
    note: input.note.trim().slice(0, 2000) || null,
    storage_path: input.storagePath,
    file_name: input.fileName.slice(0, 200),
  });

  if (error) {
    await createAdminClient().storage.from(ASSIGNMENTS_BUCKET).remove([input.storagePath]);
    return { ok: false, error: "Couldn't submit your work. Please try again." };
  }
  revalidateAssignments();
  return { ok: true };
}

/** Lets a student take back a submission (e.g. the wrong file) until it's been checked. */
export async function deleteMySubmission(submissionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not signed in." };

  // RLS only lets this delete the caller's own, not-yet-checked row.
  const { data: row, error } = await supabase
    .from("assignment_submissions")
    .delete()
    .eq("id", submissionId)
    .select("storage_path")
    .maybeSingle();

  if (error || !row) return { ok: false, error: "Couldn't delete this. It may already have been checked." };
  await createAdminClient().storage.from(ASSIGNMENTS_BUCKET).remove([row.storage_path]);
  revalidateAssignments();
  return { ok: true };
}
