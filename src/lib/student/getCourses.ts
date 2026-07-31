import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type MyCourse = {
  courseId: string;
  title: string;
  phaseTitle: string;
  levelName: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  nextLessonId: string | null;
};

type AccessQueryRow = {
  course_id: string;
  course_content: {
    id: string;
    title: string;
    display_order: number;
    phases: { title: string } | null;
    levels: { name: string } | null;
    course_weeks: {
      id: string;
      display_order: number;
      course_lessons: { id: string; display_order: number }[];
    }[];
  } | null;
};

function byOrder<T extends { display_order: number }>(a: T, b: T) {
  return a.display_order - b.display_order;
}

/**
 * Every course this student currently has ACTIVE access to. RLS on
 * course_content/course_weeks/course_lessons (see
 * supabase/007_course_content.sql) already hides anything unpublished or
 * soft-deleted from this nested embed — a revoked/unpublished course
 * simply comes back as course_content: null and is filtered out below.
 */
export async function getMyCourses(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<MyCourse[]> {
  const [accessResult, progressResult] = await Promise.all([
    supabase
      .from("student_course_access")
      .select(
        `course_id,
         course_content (
           id, title, display_order,
           phases ( title ), levels ( name ),
           course_weeks ( id, display_order, course_lessons ( id, display_order ) )
         )`
      )
      .eq("student_id", studentId)
      .eq("status", "ACTIVE"),
    supabase.from("student_lesson_progress").select("lesson_id").eq("student_id", studentId),
  ]);

  if (accessResult.error) throw accessResult.error;
  if (progressResult.error) throw progressResult.error;

  const completed = new Set((progressResult.data ?? []).map((p) => p.lesson_id));

  const rows = (accessResult.data ?? []) as unknown as AccessQueryRow[];

  return rows
    .filter((r) => r.course_content != null)
    .map((r) => r.course_content!)
    .sort(byOrder)
    .map((course) => {
      const lessons = [...course.course_weeks]
        .sort(byOrder)
        .flatMap((w) => [...w.course_lessons].sort(byOrder));

      const completedLessons = lessons.filter((l) => completed.has(l.id)).length;
      const nextLesson = lessons.find((l) => !completed.has(l.id)) ?? null;

      return {
        courseId: course.id,
        title: course.title,
        phaseTitle: course.phases?.title ?? "—",
        levelName: course.levels?.name ?? null,
        totalLessons: lessons.length,
        completedLessons,
        progressPercent: lessons.length === 0 ? 0 : Math.round((completedLessons / lessons.length) * 100),
        nextLessonId: nextLesson?.id ?? null,
      };
    });
}
