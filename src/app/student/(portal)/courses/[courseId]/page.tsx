import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStudentCourseDetail } from "@/lib/student/getCourseDetail";
import ProgressBar from "@/components/student/ProgressBar";

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

  const allLessons = course.weeks.flatMap((w) => w.lessons);
  const nextLesson = allLessons.find((l) => !l.completed) ?? allLessons[0] ?? null;

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
        {nextLesson === null ? (
          <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-navy/60">
              Content for this course is coming soon.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-navy/10 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-red-dark">
              {course.completedLessons > 0 ? "Continue Learning" : "Get Started"}
            </p>
            <p className="mt-1 text-sm text-navy/60">
              Use the course index on the left to jump to any week — or pick up here:
            </p>
            <Link
              href={`/student/courses/${courseId}/lessons/${nextLesson.id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-red px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-red/30 hover:bg-red-dark"
            >
              {nextLesson.title}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
