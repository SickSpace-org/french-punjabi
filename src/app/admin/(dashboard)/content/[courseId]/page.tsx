import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCourseDetail } from "@/lib/content/getCourseDetail";
import CourseDetailClient from "@/components/admin/content/CourseDetailClient";

export const revalidate = 0;

export default async function AdminCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const course = await getCourseDetail(supabase, courseId);
  if (!course) notFound();

  return (
    <div>
      <Link
        href="/admin/content"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/60 hover:text-red-dark"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to Course Content
      </Link>

      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-red">
          {course.phaseTitle}
          {course.levelName ? ` — ${course.levelName}` : ""}
        </p>
        <h1 className="font-display text-2xl font-bold text-navy">{course.title}</h1>
      </div>

      <div className="mt-8">
        <CourseDetailClient initialCourse={course} />
      </div>
    </div>
  );
}
