import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { formatCourseLabel } from "@/lib/courses/batchLabel";
import { resolveTeacherBatchLabels } from "./resolveTeacherBatchLabels";

export type TeacherFeedbackReply = { id: string; body: string; createdAt: string };

export type TeacherFeedbackThread = {
  noteId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** Flat, oldest-first — mirrors lesson_comments' "any number of flat replies under one top-level item" shape, not a single fixed reply. Always student-authored (see supabase/037_student_feedback_notes.sql). */
  replies: TeacherFeedbackReply[];
};

export type TeacherRosterStudent = {
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  /** e.g. "Foundation — Level 1 — 9:00 PM EST" — resolved from that student's own current enrollment, never a raw enrollments row (see teacher_batch_roster() in supabase/030_teacher_batch_access.sql — no payment/pricing field is ever selected). */
  courseLabel: string;
  /** Newest first. Private per-student feedback notes this teacher has written for this student in this batch, each with any student replies. */
  feedbackThreads: TeacherFeedbackThread[];
};

export type TeacherRecording = {
  id: string;
  url: string;
  title: string | null;
  classDate: string | null;
  createdAt: string;
};

export type TeacherMaterial = {
  id: string;
  title: string;
  storagePath: string;
  /** Signed download URL, minted server-side using this same teacher's session — null if signing failed (e.g. the object was removed from Storage without going through deleteBatchMaterial). */
  downloadUrl: string | null;
  createdAt: string;
};

export type TeacherSentMessageRecipient = { studentId: string; fullName: string; isRead: boolean };

export type TeacherSentMessage = {
  broadcastId: string;
  body: string;
  createdAt: string;
  /** One row per recipient this broadcast actually reached — see teacher_messages, supabase/036_teacher_messages.sql (one table row per recipient, sharing a broadcast_id). Length 1 = an individual send; >1 = a whole-batch announcement. */
  recipients: TeacherSentMessageRecipient[];
};

export type TeacherDashboardBatch = {
  batchId: string;
  label: string;
  meetingLink: string | null;
  classDays: number[];
  classTime: string | null;
  students: TeacherRosterStudent[];
  recordings: TeacherRecording[];
  materials: TeacherMaterial[];
  sentMessages: TeacherSentMessage[];
};

/**
 * A logged-in teacher's own dashboard: their assigned batch(es) and each
 * one's roster.
 *
 * The `batches` query below explicitly filters `.eq("teacher_id",
 * teacherId)` — it does NOT rely on RLS alone to narrow "my batches."
 * That used to be the (buggy) assumption here: batches_teacher_select
 * (teacher_id = current_teacher_id()) is itself correct and gap-free, but
 * `batches` also has a much older, unrelated policy — batches_public_select
 * — that permits ANY authenticated user to read any active, non-hidden
 * batch (that's what makes the public Courses page work). RLS policies for
 * the same command are OR'd together, so a plain unfiltered select
 * returned "my batch" UNION "every other live, publicly-advertised batch
 * in the app" — which in practice is most of them, since real batches are
 * meant to be publicly visible. That surfaced as the dashboard showing
 * random unassigned batches with no students/schedule. RLS was never
 * going to be sufficient here on its own: `batches` legitimately has
 * public rows, so "give me only mine" has to be asserted by the query
 * itself, with RLS staying as the defense-in-depth backstop it already is
 * for the genuinely private data (the roster, still exclusively behind
 * teacher_batch_roster()'s internal ownership check below).
 */
export async function getTeacherDashboard(
  supabase: SupabaseClient<Database>,
  teacherId: string
): Promise<TeacherDashboardBatch[]> {
  const { data: batches, error: batchesError } = await supabase
    .from("batches")
    .select("id, phase_id, level_id, name, time_label, timezone, meeting_link, class_days, class_time")
    .eq("teacher_id", teacherId)
    .order("display_order");
  if (batchesError) throw batchesError;
  if (!batches || batches.length === 0) return [];

  const labelByBatchId = await resolveTeacherBatchLabels(supabase, batches);

  const dashboard: TeacherDashboardBatch[] = [];
  for (const batch of batches) {
    const { data: roster, error: rosterError } = await supabase.rpc("teacher_batch_roster", {
      p_batch_id: batch.id,
    });
    if (rosterError) throw rosterError;

    const { data: noteRows, error: notesError } = await supabase
      .from("student_feedback_notes")
      .select("id, student_id, parent_note_id, body, created_at, updated_at")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: true });
    if (notesError) throw notesError;

    const threadsByNoteId = new Map<string, TeacherFeedbackThread>();
    const threadsByStudentId = new Map<string, TeacherFeedbackThread[]>();
    for (const n of noteRows ?? []) {
      if (n.parent_note_id === null) {
        const thread: TeacherFeedbackThread = {
          noteId: n.id,
          body: n.body,
          createdAt: n.created_at,
          updatedAt: n.updated_at,
          replies: [],
        };
        threadsByNoteId.set(n.id, thread);
        const list = threadsByStudentId.get(n.student_id) ?? [];
        list.push(thread);
        threadsByStudentId.set(n.student_id, list);
      }
    }
    for (const n of noteRows ?? []) {
      if (n.parent_note_id !== null) {
        threadsByNoteId.get(n.parent_note_id)?.replies.push({ id: n.id, body: n.body, createdAt: n.created_at });
      }
    }
    for (const list of threadsByStudentId.values()) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const students = (roster ?? [])
      .map((r) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        country: r.country,
        courseLabel: formatCourseLabel(r.phase_name, r.level_name, r.batch_timing),
        feedbackThreads: threadsByStudentId.get(r.student_id) ?? [],
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const { data: recordingRows, error: recordingsError } = await supabase
      .from("class_recordings")
      .select("id, url, title, class_date, created_at")
      .eq("batch_id", batch.id)
      .order("class_date", { ascending: false, nullsFirst: false });
    if (recordingsError) throw recordingsError;

    const recordings: TeacherRecording[] = (recordingRows ?? []).map((r) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      classDate: r.class_date,
      createdAt: r.created_at,
    }));

    const { data: materialRows, error: materialsError } = await supabase
      .from("batch_materials")
      .select("id, title, storage_path, created_at")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: false });
    if (materialsError) throw materialsError;

    const materials: TeacherMaterial[] = await Promise.all(
      (materialRows ?? []).map(async (m) => {
        const { data: signed } = await supabase.storage
          .from("batch-materials")
          .createSignedUrl(m.storage_path, 60 * 60);
        return {
          id: m.id,
          title: m.title,
          storagePath: m.storage_path,
          downloadUrl: signed?.signedUrl ?? null,
          createdAt: m.created_at,
        };
      })
    );

    const nameByStudentId = new Map(students.map((s) => [s.studentId, s.fullName]));

    // Explicitly scoped to THIS teacher, not just this batch — otherwise an
    // admin broadcast to this same batch (teacher_id null, see
    // supabase/038_admin_messages.sql) would show up in "my sent messages"
    // as if this teacher had sent it. Same "filter explicitly, don't rely
    // on batch_id alone" lesson as getTeacherDashboard's own batches query
    // above.
    const { data: messageRows, error: messagesError } = await supabase
      .from("teacher_messages")
      .select("broadcast_id, student_id, body, is_read, created_at")
      .eq("batch_id", batch.id)
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    if (messagesError) throw messagesError;

    const messagesByBroadcast = new Map<string, TeacherSentMessage>();
    for (const m of messageRows ?? []) {
      let group = messagesByBroadcast.get(m.broadcast_id);
      if (!group) {
        group = { broadcastId: m.broadcast_id, body: m.body, createdAt: m.created_at, recipients: [] };
        messagesByBroadcast.set(m.broadcast_id, group);
      }
      group.recipients.push({
        studentId: m.student_id,
        fullName: nameByStudentId.get(m.student_id) ?? "Former student",
        isRead: m.is_read,
      });
    }

    dashboard.push({
      batchId: batch.id,
      label: labelByBatchId.get(batch.id) ?? "Course",
      meetingLink: batch.meeting_link,
      classDays: batch.class_days,
      classTime: batch.class_time,
      students,
      recordings,
      materials,
      sentMessages: Array.from(messagesByBroadcast.values()),
    });
  }

  return dashboard;
}
