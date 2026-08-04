import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { resolveR2PlaybackUrl } from "@/lib/r2/server";
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

  // Uploaded videos are keyed by storage path rather than a public URL, so
  // mint a real playback URL here, long-lived enough to cover watching a
  // full 1hr+ recording in one sitting. "upload" = legacy Supabase Storage
  // bucket (supabase/012_lesson_videos_storage.sql); "r2" = current
  // Cloudflare R2 bucket (src/lib/r2/server.ts). Both are kept working so
  // lessons uploaded before the R2 migration don't break.
  let videoUrl = lesson.video_url;
  if (lesson.video_provider === "upload" && lesson.video_url) {
    const { data: signed } = await supabase.storage
      .from("lesson-videos")
      .createSignedUrl(lesson.video_url, 6 * 60 * 60);
    videoUrl = signed?.signedUrl ?? null;
  } else if (lesson.video_provider === "r2" && lesson.video_url) {
    videoUrl = await resolveR2PlaybackUrl(lesson.video_url);
  }

  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    notes: lesson.notes,
    videoUrl,
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
