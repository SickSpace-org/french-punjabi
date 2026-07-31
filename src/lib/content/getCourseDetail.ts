import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CourseContentRow,
  CourseLessonRow,
  CourseWeekRow,
  Database,
  LessonResourceRow,
} from "@/types/database";

export type AdminLesson = CourseLessonRow & { resources: LessonResourceRow[] };
export type AdminWeek = CourseWeekRow & { lessons: AdminLesson[] };
export type AdminCourseDetail = CourseContentRow & {
  phaseTitle: string;
  levelName: string | null;
  weeks: AdminWeek[];
};

type CourseDetailQueryRow = CourseContentRow & {
  phases: { title: string } | null;
  levels: { name: string } | null;
  course_weeks: (CourseWeekRow & {
    course_lessons: (CourseLessonRow & { lesson_resources: LessonResourceRow[] })[];
  })[];
};

function byDisplayOrder<T extends { display_order: number }>(a: T, b: T) {
  return a.display_order - b.display_order;
}

export async function getCourseDetail(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<AdminCourseDetail | null> {
  const { data, error } = await supabase
    .from("course_content")
    .select(
      `*,
       phases ( title ),
       levels ( name ),
       course_weeks ( *, course_lessons ( *, lesson_resources ( * ) ) )`
    )
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as CourseDetailQueryRow;
  const { phases, levels, course_weeks, ...course } = row;

  const weeks: AdminWeek[] = [...course_weeks].sort(byDisplayOrder).map((week) => {
    const { course_lessons, ...weekFields } = week;
    return {
      ...weekFields,
      lessons: [...course_lessons]
        .sort(byDisplayOrder)
        .map((lesson) => {
          const { lesson_resources, ...lessonFields } = lesson;
          return {
            ...lessonFields,
            resources: [...lesson_resources].sort(byDisplayOrder),
          };
        }),
    };
  });

  return {
    ...course,
    phaseTitle: phases?.title ?? "—",
    levelName: levels?.name ?? null,
    weeks,
  };
}
