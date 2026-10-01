import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type StudentNotification =
  | {
      kind: "lesson_reply";
      id: string;
      message: string;
      isRead: boolean;
      createdAt: string;
      lessonId: string;
      lessonTitle: string;
      courseId: string;
    }
  | {
      kind: "teacher_message";
      id: string;
      message: string;
      isRead: boolean;
      createdAt: string;
      /** Frozen at send time (see teacher_name_snapshot, supabase/036_teacher_messages.sql) so it stays correct even if that teacher is later removed. */
      teacherName: string;
    }
  | {
      kind: "admin_message";
      id: string;
      message: string;
      isRead: boolean;
      createdAt: string;
    };

type LessonNotificationQueryRow = {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  lesson_id: string;
  course_lessons: { title: string; course_id: string } | null;
};

/**
 * Merges two DIFFERENT tables into one inbox: student_notifications (a
 * teacher's reply to a lesson question — always lesson-shaped) and
 * teacher_messages (a direct message/announcement — never lesson-shaped).
 * Deliberately NOT the same table — see supabase/036_teacher_messages.sql
 * for why extending student_notifications turned out to be the wrong
 * call (NotificationRow.tsx already hard-assumes every row has a lesson to
 * link to). This is the ONE place both sources come together, so every
 * caller (this page, the dashboard's unread-count banner) automatically
 * sees both without knowing two tables exist.
 */
export async function getStudentNotifications(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<StudentNotification[]> {
  const [lessonResult, messageResult] = await Promise.all([
    supabase
      .from("student_notifications")
      .select("id, message, is_read, created_at, lesson_id, course_lessons ( title, course_id )")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_messages")
      .select("id, body, is_read, created_at, teacher_name_snapshot, is_admin_message")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
  ]);

  if (lessonResult.error) throw lessonResult.error;
  if (messageResult.error) throw messageResult.error;

  const lessonNotifications: StudentNotification[] = ((lessonResult.data ?? []) as unknown as LessonNotificationQueryRow[]).map(
    (n) => ({
      kind: "lesson_reply",
      id: n.id,
      message: n.message,
      isRead: n.is_read,
      createdAt: n.created_at,
      lessonId: n.lesson_id,
      lessonTitle: n.course_lessons?.title ?? "Lesson",
      courseId: n.course_lessons?.course_id ?? "",
    })
  );

  // is_admin_message (supabase/038_admin_messages.sql) picks a THIRD kind
  // here, parallel to how teacher_message itself was added alongside
  // lesson_reply — never inferred from teacher_id being null, which
  // already has a different meaning (a hard-deleted teacher).
  const teacherMessages: StudentNotification[] = (messageResult.data ?? []).map((m) =>
    m.is_admin_message
      ? { kind: "admin_message", id: m.id, message: m.body, isRead: m.is_read, createdAt: m.created_at }
      : { kind: "teacher_message", id: m.id, message: m.body, isRead: m.is_read, createdAt: m.created_at, teacherName: m.teacher_name_snapshot }
  );

  return [...lessonNotifications, ...teacherMessages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Count-only — used by the nav bell badge (StudentShell.tsx), fetched on
 * every server-rendered navigation (see the layout, which calls this per
 * request). Deliberately NOT getStudentNotifications() + .length: that
 * fetches full bodies and a course_lessons join just to throw them away,
 * which would run on every single page load across the whole portal, not
 * just the notifications page itself.
 */
export async function getUnreadNotificationCount(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<number> {
  const [lessonResult, messageResult] = await Promise.all([
    supabase
      .from("student_notifications")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("is_read", false),
    supabase
      .from("teacher_messages")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("is_read", false),
  ]);

  if (lessonResult.error) throw lessonResult.error;
  if (messageResult.error) throw messageResult.error;

  return (lessonResult.count ?? 0) + (messageResult.count ?? 0);
}
