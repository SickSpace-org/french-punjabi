import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type StudentLessonSummary = {
  id: string;
  title: string;
  displayOrder: number;
  completed: boolean;
};

export type StudentWeekSummary = {
  id: string;
  weekNumber: number;
  title: string;
  description: string | null;
  lessons: StudentLessonSummary[];
};

export type StudentCourseDetail = {
  id: string;
  title: string;
  description: string | null;
  phaseTitle: string;
  levelName: string | null;
  weeks: StudentWeekSummary[];
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
};

type CourseQueryRow = {
  id: string;
  title: string;
  description: string | null;
  phases: { title: string } | null;
  levels: { name: string } | null;
  course_weeks: {
    id: string;
    week_number: number;
    title: string;
    description: string | null;
    display_order: number;
    course_lessons: { id: string; title: string; display_order: number }[];
  }[];
};

function byOrder<T extends { display_order: number }>(a: T, b: T) {
  return a.display_order - b.display_order;
}

/**
 * Full course + weeks + lessons for a student, or null if they don't have
 * ACTIVE access — checked explicitly here (not just left to RLS) so the
 * page can render a clean "not found" instead of a confusingly empty
 * course. RLS on course_content/course_weeks/course_lessons is the real
 * enforcement layer regardless (see supabase/007_course_content.sql) — a
 * tampered courseId in the URL gets denied by the database even if this
 * check were somehow skipped.
 */
export async function getStudentCourseDetail(
  supabase: SupabaseClient<Database>,
  studentId: string,
  courseId: string
): Promise<StudentCourseDetail | null> {
  const { data: access } = await supabase
    .from("student_course_access")
    .select("id")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!access) return null;

  const { data, error } = await supabase
    .from("course_content")
    .select(
      `id, title, description,
       phases ( title ), levels ( name ),
       course_weeks ( id, week_number, title, description, display_order,
         course_lessons ( id, title, display_order ) )`
    )
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const course = data as unknown as CourseQueryRow;

  const { data: progressRows } = await supabase
    .from("student_lesson_progress")
    .select("lesson_id")
    .eq("student_id", studentId);

  const completed = new Set((progressRows ?? []).map((p) => p.lesson_id));

  const weeks: StudentWeekSummary[] = [...course.course_weeks].sort(byOrder).map((week) => ({
    id: week.id,
    weekNumber: week.week_number,
    title: week.title,
    description: week.description,
    lessons: [...week.course_lessons].sort(byOrder).map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      displayOrder: lesson.display_order,
      completed: completed.has(lesson.id),
    })),
  }));

  const allLessons = weeks.flatMap((w) => w.lessons);
  const completedLessons = allLessons.filter((l) => l.completed).length;

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    phaseTitle: course.phases?.title ?? "—",
    levelName: course.levels?.name ?? null,
    weeks,
    totalLessons: allLessons.length,
    completedLessons,
    progressPercent:
      allLessons.length === 0 ? 0 : Math.round((completedLessons / allLessons.length) * 100),
  };
}
