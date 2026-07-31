import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStudentCourseDetail } from "@/lib/student/getCourseDetail";
import ProgressBar from "@/components/student/ProgressBar";
import WeekAccordion from "@/components/student/WeekAccordion";

export const revalidate = 0;

export default async function StudentCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) notFound();

  // Deny access if the student has no ACTIVE access to this course, or the
  // course/its content is unpublished — RLS backs this up independently
  // regardless of what the URL says.
  const course = await getStudentCourseDetail(supabase, student.id, courseId);
  if (!course) notFound();

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-red">
        {course.phaseTitle}
        {course.levelName ? ` — ${course.levelName}` : ""}
      </p>
      <h1 className="font-display text-2xl font-bold text-navy">{course.title}</h1>
      {course.description ? <p className="mt-1 text-sm text-navy/60">{course.description}</p> : null}

      <div className="mt-5 max-w-md">
        <ProgressBar percent={course.progressPercent} label="Course Progress" />
      </div>

      <div className="mt-8">
        {course.weeks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-navy/60">
              Content for this course is coming soon.
            </p>
          </div>
        ) : (
          <WeekAccordion courseId={course.id} weeks={course.weeks} />
        )}
      </div>
    </div>
  );
}
