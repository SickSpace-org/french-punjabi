import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type StudentCommentReply = {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: string;
  isTeacher: boolean;
  isOwn: boolean;
};

export type StudentComment = {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: string;
  isOwn: boolean;
  replies: StudentCommentReply[];
};

type CommentQueryRow = {
  id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  student_id: string | null;
  admin_id: string | null;
  students: { full_name: string } | null;
};

/** Shared per-lesson Q&A — RLS (lesson_comments_student_select) already
 * scopes this to lessons the caller has access to. */
export async function getLessonComments(
  supabase: SupabaseClient<Database>,
  lessonId: string,
  currentStudentId: string
): Promise<StudentComment[]> {
  const { data, error } = await supabase
    .from("lesson_comments")
    .select("id, body, created_at, parent_comment_id, student_id, admin_id, students ( full_name )")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as CommentQueryRow[];
  const questions = rows.filter((r) => r.parent_comment_id === null);

  return questions.map((q) => ({
    id: q.id,
    body: q.body,
    createdAt: q.created_at,
    authorLabel: q.students?.full_name ?? "Student",
    isOwn: q.student_id === currentStudentId,
    replies: rows
      .filter((r) => r.parent_comment_id === q.id)
      .map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        authorLabel: r.admin_id ? "Teacher" : (r.students?.full_name ?? "Student"),
        isTeacher: r.admin_id != null,
        isOwn: r.student_id === currentStudentId,
      })),
  }));
}
