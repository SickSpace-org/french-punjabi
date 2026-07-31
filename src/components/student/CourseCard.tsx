import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import type { MyCourse } from "@/lib/student/getCourses";
import ProgressBar from "./ProgressBar";

export default function CourseCard({ course }: { course: MyCourse }) {
  const continueHref = course.nextLessonId
    ? `/student/courses/${course.courseId}/lessons/${course.nextLessonId}`
    : `/student/courses/${course.courseId}`;

  return (
    <div className="laminate rounded-3xl border border-navy/10 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red">
          <GraduationCap className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red">
            {course.phaseTitle}
            {course.levelName ? ` — ${course.levelName}` : ""}
          </p>
          <p className="truncate font-display text-lg font-bold text-navy">{course.title}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-navy/60">
        Batch:{" "}
        <span className="font-semibold text-navy">
          {course.completedLessons} / {course.totalLessons} Lessons Completed
        </span>
      </p>

      <div className="mt-3">
        <ProgressBar percent={course.progressPercent} label="Progress" />
      </div>

      <Link
        href={continueHref}
        className="group/btn mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-lg"
      >
        Continue Learning
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
          strokeWidth={2.5}
        />
      </Link>
    </div>
  );
}
