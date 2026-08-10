import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStudentCourseDetail } from "@/lib/student/getCourseDetail";
import CourseSidebar from "@/components/student/CourseSidebar";

export const revalidate = 0;

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) notFound();

  // Same access check as each page below performs on its own data — if the
  // course doesn't exist/isn't accessible, let the page 404 itself instead
  // of duplicating that here for a layout that has nothing to show anyway.
  const course = await getStudentCourseDetail(supabase, student.id, courseId);
  if (!course) return <>{children}</>;

  return (
    <div className="lg:flex lg:items-start lg:gap-8">
      {course.weeks.length > 0 ? (
        <CourseSidebar courseId={course.id} courseTitle={course.title} weeks={course.weeks} />
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
