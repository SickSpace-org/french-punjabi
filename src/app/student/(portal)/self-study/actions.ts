"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { SELF_STUDY_BUCKET } from "@/lib/selfStudy/constants";
import type { SelfStudySubmissionKind } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SubmissionInput = {
  kind: SelfStudySubmissionKind;
  assignmentId: string | null;
  note: string;
  storagePath: string;
  fileName: string;
  durationSeconds: number | null;
};

function revalidateSelfStudy() {
  revalidatePath("/student/self-study");
  revalidatePath("/admin/self-study");
}

/**
 * Saves the row for a file the student's browser already uploaded to their
 * own submissions/{studentId}/ folder. RLS (self_study_submissions_student_insert)
 * independently re-checks that the row and the path both belong to the
 * caller. If the row can't be saved, the uploaded file is removed again so
 * nothing is left behind.
 */
export async function createSubmission(input: SubmissionInput): Promise<ActionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student || student.status !== "ACTIVE") return { ok: false, error: "Not signed in." };

  const ownPrefix = `submissions/${student.id}/`;
  if (!input.storagePath.startsWith(ownPrefix)) return { ok: false, error: "Invalid file path." };
  if (input.kind !== "PDF" && input.kind !== "VOICE") return { ok: false, error: "Invalid submission type." };

  const { error } = await supabase.from("self_study_submissions").insert({
    student_id: student.id,
    assignment_id: input.assignmentId,
    kind: input.kind,
    note: input.note.trim().slice(0, 2000) || null,
    storage_path: input.storagePath,
    file_name: input.fileName.slice(0, 200),
    duration_seconds:
      input.durationSeconds != null ? Math.max(0, Math.round(input.durationSeconds)) : null,
  });

  if (error) {
    await createAdminClient().storage.from(SELF_STUDY_BUCKET).remove([input.storagePath]);
    return { ok: false, error: "Couldn't send your work. Please try again." };
  }
  revalidateSelfStudy();
  return { ok: true };
}

/** Lets a student take back something they sent (e.g. the wrong file). */
export async function deleteMySubmission(submissionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return { ok: false, error: "Not signed in." };

  // RLS only lets this delete the caller's own row.
  const { data: row, error } = await supabase
    .from("self_study_submissions")
    .delete()
    .eq("id", submissionId)
    .select("storage_path")
    .maybeSingle();

  if (error || !row) return { ok: false, error: "Couldn't delete this." };
  await createAdminClient().storage.from(SELF_STUDY_BUCKET).remove([row.storage_path]);
  revalidateSelfStudy();
  return { ok: true };
}
