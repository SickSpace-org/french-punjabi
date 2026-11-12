import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentRow, AssignmentSubmissionRow, Database } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBatchOptions, getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import { ASSIGNMENTS_BUCKET } from "./constants";

type Supabase = SupabaseClient<Database>;

/** Thrown when supabase/066_assignments.sql hasn't been run yet. */
export class AssignmentsTableMissingError extends Error {}

/** Signed links last an hour; the page re-signs on every load. */
const SIGNED_URL_SECONDS = 60 * 60;

function throwIfMissing(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205") throw new AssignmentsTableMissingError(error.message);
  throw error;
}

async function signPaths(supabase: Supabase, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(ASSIGNMENTS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) {
    console.error("[Assignments] Failed to sign file links:", error);
    return new Map();
  }
  const urls = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export type AssignmentSubmissionView = AssignmentSubmissionRow & { url: string | null };

export type StudentAssignmentView = AssignmentRow & {
  url: string | null;
  audienceLabel: string;
  /** This student's own submissions for it, newest first. */
  submissions: AssignmentSubmissionView[];
};

export type StudentAssignmentsData = {
  assignments: StudentAssignmentView[];
  /** The student's live submissions whose assignment has already expired or been deleted. */
  earlierSubmissions: AssignmentSubmissionView[];
};

export type AdminAssignmentSubmissionView = AssignmentSubmissionView & {
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
};

export type AdminAssignmentView = AssignmentRow & {
  url: string | null;
  audienceLabel: string;
  submissionCount: number;
  uncheckedCount: number;
};

export type AdminAssignmentsData = {
  assignments: AdminAssignmentView[];
  submissions: AdminAssignmentSubmissionView[];
  batchOptions: { id: string; label: string }[];
};

export async function getAdminAssignments(supabase: Supabase): Promise<AdminAssignmentsData> {
  const nowIso = new Date().toISOString();
  const [assignmentsResult, submissionsResult, courseData] = await Promise.all([
    supabase.from("assignments").select("*").gt("expires_at", nowIso).order("created_at", { ascending: false }),
    supabase.from("assignment_submissions").select("*").gt("expires_at", nowIso).order("created_at", { ascending: false }),
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

  const counts = new Map<string, { total: number; unchecked: number }>();
  for (const s of submissions) {
    if (!s.assignment_id) continue;
    const c = counts.get(s.assignment_id) ?? { total: 0, unchecked: 0 };
    c.total += 1;
    if (!s.reviewed_at) c.unchecked += 1;
    counts.set(s.assignment_id, c);
  }

  return {
    assignments: assignments.map((a) => ({
      ...a,
      url: urls.get(a.storage_path) ?? null,
      audienceLabel: a.batch_id ? (batchLabelById.get(a.batch_id) ?? "One batch") : "All students",
      submissionCount: counts.get(a.id)?.total ?? 0,
      uncheckedCount: counts.get(a.id)?.unchecked ?? 0,
    })),
    submissions: submissions.map((s) => ({
      ...s,
      url: urls.get(s.storage_path) ?? null,
      assignmentTitle: s.assignment_title || "Removed assignment",
      studentName: studentById.get(s.student_id)?.full_name ?? "Unknown student",
      studentEmail: studentById.get(s.student_id)?.email ?? "",
    })),
    batchOptions,
  };
}

/**
 * Rows come through the student's own RLS-scoped client (so they only ever
 * see assignments meant for them and their own submissions); the file links
 * are then signed with the service role, since students have no direct
 * read access to the bucket.
 */
export async function getStudentAssignments(supabase: Supabase): Promise<StudentAssignmentsData> {
  const nowIso = new Date().toISOString();
  const [assignmentsResult, submissionsResult] = await Promise.all([
    supabase.from("assignments").select("*").gt("expires_at", nowIso).order("created_at", { ascending: false }),
    supabase.from("assignment_submissions").select("*").gt("expires_at", nowIso).order("created_at", { ascending: false }),
  ]);
  throwIfMissing(assignmentsResult.error);
  throwIfMissing(submissionsResult.error);

  const assignments = assignmentsResult.data ?? [];
  const submissions = submissionsResult.data ?? [];

  const urls = await signPaths(createAdminClient(), [
    ...assignments.map((a) => a.storage_path),
    ...submissions.map((s) => s.storage_path),
  ]);

  const liveIds = new Set(assignments.map((a) => a.id));
  const byAssignment = new Map<string, AssignmentSubmissionView[]>();
  const earlierSubmissions: AssignmentSubmissionView[] = [];
  for (const s of submissions) {
    const view = { ...s, url: urls.get(s.storage_path) ?? null };
    if (s.assignment_id && liveIds.has(s.assignment_id)) {
      const list = byAssignment.get(s.assignment_id) ?? [];
      list.push(view);
      byAssignment.set(s.assignment_id, list);
    } else {
      earlierSubmissions.push(view);
    }
  }

  return {
    assignments: assignments.map((a) => ({
      ...a,
      url: urls.get(a.storage_path) ?? null,
      audienceLabel: a.batch_id ? "Your batch" : "All students",
      submissions: byAssignment.get(a.id) ?? [],
    })),
    earlierSubmissions,
  };
}
