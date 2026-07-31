import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseContentRow, Database } from "@/types/database";

export type AdminPhaseOption = {
  id: string;
  phaseNumber: number;
  title: string;
  levels: { id: string; name: string }[];
};

export type AdminCourseSummary = CourseContentRow & {
  phaseTitle: string;
  levelName: string | null;
  weekCount: number;
  lessonCount: number;
};

type CourseQueryRow = CourseContentRow & {
  phases: { title: string } | null;
  levels: { name: string } | null;
  course_weeks: { id: string; course_lessons: { id: string }[] }[];
};

/**
 * Admin index for /admin/content — every learning course (draft + published,
 * active + soft-deleted), with a phase/level label and week/lesson counts.
 * This is separate from getAdminCourseData (which manages the public
 * pricing/batches/timings "Courses" data, an unrelated concept).
 */
export async function getAdminContentData(supabase: SupabaseClient<Database>): Promise<{
  courses: AdminCourseSummary[];
  phaseOptions: AdminPhaseOption[];
}> {
  const [coursesResult, phasesResult] = await Promise.all([
    supabase
      .from("course_content")
      .select("*, phases ( title ), levels ( name ), course_weeks ( id, course_lessons ( id ) )")
      .order("display_order"),
    supabase
      .from("phases")
      .select("id, phase_number, title, levels ( id, name )")
      .order("display_order"),
  ]);

  if (coursesResult.error) throw coursesResult.error;
  if (phasesResult.error) throw phasesResult.error;

  const courses = ((coursesResult.data ?? []) as unknown as CourseQueryRow[]).map((row) => {
    const { phases, levels, course_weeks, ...course } = row;
    return {
      ...course,
      phaseTitle: phases?.title ?? "—",
      levelName: levels?.name ?? null,
      weekCount: course_weeks.length,
      lessonCount: course_weeks.reduce((sum, w) => sum + w.course_lessons.length, 0),
    };
  });

  const phaseOptions: AdminPhaseOption[] = (
    (phasesResult.data ?? []) as unknown as {
      id: string;
      phase_number: number;
      title: string;
      levels: { id: string; name: string }[];
    }[]
  ).map((p) => ({ id: p.id, phaseNumber: p.phase_number, title: p.title, levels: p.levels }));

  return { courses, phaseOptions };
}
