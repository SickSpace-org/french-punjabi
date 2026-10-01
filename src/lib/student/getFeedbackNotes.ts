import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type StudentFeedbackReply = { id: string; body: string; createdAt: string };

export type StudentFeedbackThread = {
  noteId: string;
  body: string;
  createdAt: string;
  /** Frozen at write time (see teacher_name_snapshot, supabase/037_student_feedback_notes.sql) so it stays correct even if that teacher is later removed. */
  teacherName: string;
  /** Own replies only, oldest first — nobody else can ever appear here (see is_own_student_id on student_feedback_notes_student_select). */
  replies: StudentFeedbackReply[];
};

/**
 * ALL of this student's feedback notes, not just ones from their current
 * batch — unlike recordings/materials (getCurrentBatch.ts), a note stays
 * relevant even after the student moves to a different batch/teacher,
 * same reasoning as why student_notifications/teacher_messages aren't
 * "current batch only" either. Reaches this student via
 * student_feedback_notes_student_select's is_own_student_id(student_id)
 * check — no other student's notes can ever come back here.
 */
export async function getStudentFeedbackNotes(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<StudentFeedbackThread[]> {
  const { data, error } = await supabase
    .from("student_feedback_notes")
    .select("id, parent_note_id, teacher_name_snapshot, body, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const threadsByNoteId = new Map<string, StudentFeedbackThread>();
  const threads: StudentFeedbackThread[] = [];
  for (const n of data ?? []) {
    if (n.parent_note_id === null) {
      const thread: StudentFeedbackThread = {
        noteId: n.id,
        body: n.body,
        createdAt: n.created_at,
        teacherName: n.teacher_name_snapshot,
        replies: [],
      };
      threadsByNoteId.set(n.id, thread);
      threads.push(thread);
    }
  }
  for (const n of data ?? []) {
    if (n.parent_note_id !== null) {
      threadsByNoteId.get(n.parent_note_id)?.replies.push({ id: n.id, body: n.body, createdAt: n.created_at });
    }
  }

  return threads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
