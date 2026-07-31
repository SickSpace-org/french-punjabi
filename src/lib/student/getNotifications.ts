import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type StudentNotification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
};

type NotificationQueryRow = {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  lesson_id: string;
  course_lessons: { title: string; course_id: string } | null;
};

export async function getStudentNotifications(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<StudentNotification[]> {
  const { data, error } = await supabase
    .from("student_notifications")
    .select("id, message, is_read, created_at, lesson_id, course_lessons ( title, course_id )")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as NotificationQueryRow[]).map((n) => ({
    id: n.id,
    message: n.message,
    isRead: n.is_read,
    createdAt: n.created_at,
    lessonId: n.lesson_id,
    lessonTitle: n.course_lessons?.title ?? "Lesson",
    courseId: n.course_lessons?.course_id ?? "",
  }));
}
