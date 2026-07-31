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

type CourseQueryRow = {
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
};

function byOrder<T extends { display_order: number }>(a: T, b: T) {
  return a.display_order - b.display_order;
}

/**
 * Every published course — any ACTIVE (enrolled + paid) student gets the
 * full catalog, not just courses an admin individually assigned. RLS
 * (course_content_student_select, see supabase/007 + 010) already scopes
 * this to published/active courses for the caller — querying
 * course_content directly here relies on that, same as every other
 * student-facing query in this app.
 */
export async function getMyCourses(
  supabase: SupabaseClient<Database>,
  studentId: string
): Promise<MyCourse[]> {
  const [coursesResult, progressResult] = await Promise.all([
    supabase
      .from("course_content")
      .select(
        `id, title, display_order,
         phases ( title ), levels ( name ),
         course_weeks ( id, display_order, course_lessons ( id, display_order ) )`
      )
      .order("display_order"),
    supabase.from("student_lesson_progress").select("lesson_id").eq("student_id", studentId),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (progressResult.error) throw progressResult.error;

  const completed = new Set((progressResult.data ?? []).map((p) => p.lesson_id));

  const rows = (coursesResult.data ?? []) as unknown as CourseQueryRow[];

  return rows.sort(byOrder).map((course) => {
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
