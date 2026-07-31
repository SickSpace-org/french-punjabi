import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getStudentCourseDetail } from "./getCourseDetail";

export type StudentLessonDetail = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  videoUrl: string | null;
  videoProvider: string | null;
  completed: boolean;
  weekNumber: number;
  weekTitle: string;
  courseId: string;
  courseTitle: string;
  phaseTitle: string;
  levelName: string | null;
  resources: { id: string; title: string }[];
  prevLessonId: string | null;
  nextLessonId: string | null;
};

type LessonQueryRow = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  video_url: string | null;
  video_provider: string | null;
  lesson_resources: { id: string; title: string }[];
};

/**
 * Re-derives the whole course chain (via getStudentCourseDetail, which
 * itself checks student_course_access) to find this lesson's position for
 * prev/next navigation and completion state, then fetches the lesson's
 * own fields directly. Returns null if the student has no access to the
 * course, the lesson isn't part of it, or RLS hides it (unpublished/
 * soft-deleted) — the page treats all of these identically: deny access.
 */
export async function getStudentLessonDetail(
  supabase: SupabaseClient<Database>,
  studentId: string,
  courseId: string,
  lessonId: string
): Promise<StudentLessonDetail | null> {
  const course = await getStudentCourseDetail(supabase, studentId, courseId);
  if (!course) return null;

  const flatLessons = course.weeks.flatMap((w) =>
    w.lessons.map((l) => ({ ...l, weekNumber: w.weekNumber, weekTitle: w.title }))
  );
  const index = flatLessons.findIndex((l) => l.id === lessonId);
  if (index === -1) return null;

  const currentSummary = flatLessons[index];

  const { data, error } = await supabase
    .from("course_lessons")
    .select("id, title, description, notes, video_url, video_provider, lesson_resources ( id, title )")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const lesson = data as unknown as LessonQueryRow;

  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    notes: lesson.notes,
    videoUrl: lesson.video_url,
    videoProvider: lesson.video_provider,
    completed: currentSummary.completed,
    weekNumber: currentSummary.weekNumber,
    weekTitle: currentSummary.weekTitle,
    courseId: course.id,
    courseTitle: course.title,
    phaseTitle: course.phaseTitle,
    levelName: course.levelName,
    resources: lesson.lesson_resources,
    prevLessonId: index > 0 ? flatLessons[index - 1].id : null,
    nextLessonId: index < flatLessons.length - 1 ? flatLessons[index + 1].id : null,
  };
}
