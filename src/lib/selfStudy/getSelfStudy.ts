import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SelfStudyAssignmentRow, SelfStudySubmissionRow } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBatchOptions, getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import { SELF_STUDY_BUCKET } from "./constants";

type Supabase = SupabaseClient<Database>;

/** Thrown when supabase/065_self_study.sql hasn't been run yet. */
export class SelfStudyTableMissingError extends Error {}

/** Signed links last as long as a study session; the page re-signs on every load. */
const SIGNED_URL_SECONDS = 60 * 60;

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205") throw new SelfStudyTableMissingError(error.message);
  throw error;
}

async function signPaths(supabase: Supabase, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(SELF_STUDY_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) {
    console.error("[Self Study] Failed to sign file links:", error);
    return new Map();
  }
  const urls = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export type SelfStudyAssignmentView = SelfStudyAssignmentRow & {
  url: string | null;
  /** "All students" or the batch's label. */
  audienceLabel: string;
};

export type SelfStudySubmissionView = SelfStudySubmissionRow & {
  url: string | null;
  assignmentTitle: string | null;
};

export type AdminSelfStudySubmissionView = SelfStudySubmissionView & {
  studentName: string;
  studentEmail: string;
};

export type AdminSelfStudyData = {
  assignments: (SelfStudyAssignmentView & { submissionCount: number })[];
  submissions: AdminSelfStudySubmissionView[];
  batchOptions: { id: string; label: string }[];
};

export async function getAdminSelfStudy(supabase: Supabase): Promise<AdminSelfStudyData> {
  const nowIso = new Date().toISOString();
  const [assignmentsResult, submissionsResult, courseData] = await Promise.all([
    supabase
      .from("self_study_assignments")
      .select("*")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("self_study_submissions")
      .select("*")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false }),
    getAdminCourseData(supabase),
  ]);
  throwIfMissing(assignmentsResult.error);
  throwIfMissing(submissionsResult.error);

  const assignments = assignmentsResult.data ?? [];
  const submissions = submissionsResult.data ?? [];

  const batchOptions = getActiveBatchOptions(courseData.phases);
  const batchLabelById = new Map<string, string>();
  for (const phase of courseData.phases) {
    for (const b of phase.batches) batchLabelById.set(b.id, `${phase.title} — ${formatBatchTiming(b)}`);
    for (const level of phase.levels) {
      for (const b of level.batches) batchLabelById.set(b.id, `${phase.title} — ${level.name} — ${formatBatchTiming(b)}`);
    }
  }

  const studentIds = [...new Set(submissions.map((s) => s.student_id))];
  const { data: students, error: studentsError } = studentIds.length
    ? await supabase.from("students").select("id, full_name, email").in("id", studentIds)
    : { data: [], error: null };
  if (studentsError) throw studentsError;
  const studentById = new Map((students ?? []).map((s) => [s.id, s]));

  const urls = await signPaths(supabase, [
    ...assignments.map((a) => a.storage_path),
    ...submissions.map((s) => s.storage_path),
  ]);

  const titleById = new Map(assignments.map((a) => [a.id, a.title]));
  const countByAssignment = new Map<string, number>();
  for (const s of submissions) {
    if (s.assignment_id) countByAssignment.set(s.assignment_id, (countByAssignment.get(s.assignment_id) ?? 0) + 1);
  }

  return {
    assignments: assignments.map((a) => ({
      ...a,
      url: urls.get(a.storage_path) ?? null,
      audienceLabel: a.batch_id ? (batchLabelById.get(a.batch_id) ?? "One batch") : "All students",
      submissionCount: countByAssignment.get(a.id) ?? 0,
    })),
    submissions: submissions.map((s) => ({
      ...s,
      url: urls.get(s.storage_path) ?? null,
      assignmentTitle: s.assignment_id ? (titleById.get(s.assignment_id) ?? null) : null,
      studentName: studentById.get(s.student_id)?.full_name ?? "Unknown student",
      studentEmail: studentById.get(s.student_id)?.email ?? "",
    })),
    batchOptions,
  };
}

export type StudentSelfStudyData = {
  assignments: SelfStudyAssignmentView[];
  submissions: SelfStudySubmissionView[];
};

/**
 * Rows come through the student's own RLS-scoped client (so they only ever
 * see homework meant for them and their own submissions); the file links
 * are then signed with the service role, since students have no direct
 * read access to the bucket.
 */
export async function getStudentSelfStudy(supabase: Supabase): Promise<StudentSelfStudyData> {
  const nowIso = new Date().toISOString();
  const [assignmentsResult, submissionsResult] = await Promise.all([
    supabase
      .from("self_study_assignments")
      .select("*")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("self_study_submissions")
      .select("*")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false }),
  ]);
  throwIfMissing(assignmentsResult.error);
  throwIfMissing(submissionsResult.error);

  const assignments = assignmentsResult.data ?? [];
  const submissions = submissionsResult.data ?? [];

  const urls = await signPaths(createAdminClient(), [
    ...assignments.map((a) => a.storage_path),
    ...submissions.map((s) => s.storage_path),
  ]);
  const titleById = new Map(assignments.map((a) => [a.id, a.title]));

  return {
    assignments: assignments.map((a) => ({
      ...a,
      url: urls.get(a.storage_path) ?? null,
      audienceLabel: a.batch_id ? "Your batch" : "All students",
    })),
    submissions: submissions.map((s) => ({
      ...s,
      url: urls.get(s.storage_path) ?? null,
      assignmentTitle: s.assignment_id ? (titleById.get(s.assignment_id) ?? null) : null,
    })),
  };
}
