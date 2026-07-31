import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AdminCommentReply = {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: string;
  isTeacher: boolean;
};

export type AdminComment = {
  id: string;
  body: string;
  createdAt: string;
  studentName: string;
  lessonId: string;
  lessonTitle: string;
  weekTitle: string;
  courseTitle: string;
  phaseTitle: string;
  replies: AdminCommentReply[];
};

type CommentQueryRow = {
  id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  student_id: string | null;
  admin_id: string | null;
  students: { full_name: string } | null;
  course_lessons: {
    id: string;
    title: string;
    course_weeks: { title: string } | null;
    course_content: { title: string; phases: { title: string } | null } | null;
  } | null;
};

/**
 * Every top-level student question, most-recent-first, with its replies
 * nested underneath — a central inbox so the admin never has to open each
 * lesson individually to see/answer questions.
 */
export async function getAdminComments(supabase: SupabaseClient<Database>): Promise<AdminComment[]> {
  const { data, error } = await supabase
    .from("lesson_comments")
    .select(
      `id, body, created_at, parent_comment_id, student_id, admin_id,
       students ( full_name ),
       course_lessons ( id, title, course_weeks ( title ), course_content ( title, phases ( title ) ) )`
    )
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as CommentQueryRow[];
  const questions = rows.filter((r) => r.parent_comment_id === null && r.student_id != null);

  const comments = questions.map((q) => {
    const replies: AdminCommentReply[] = rows
      .filter((r) => r.parent_comment_id === q.id)
      .map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        authorLabel: r.admin_id ? "Teacher" : (r.students?.full_name ?? "Student"),
        isTeacher: r.admin_id != null,
      }));

    return {
      id: q.id,
      body: q.body,
      createdAt: q.created_at,
      studentName: q.students?.full_name ?? "Student",
      lessonId: q.course_lessons?.id ?? "",
      lessonTitle: q.course_lessons?.title ?? "",
      weekTitle: q.course_lessons?.course_weeks?.title ?? "",
      courseTitle: q.course_lessons?.course_content?.title ?? "",
      phaseTitle: q.course_lessons?.course_content?.phases?.title ?? "",
      replies,
    };
  });

  return comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
