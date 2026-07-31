import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getMyCourses } from "@/lib/student/getCourses";
import CourseCard from "@/components/student/CourseCard";

export const revalidate = 0;

export default async function StudentCoursesPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null;

  const courses = await getMyCourses(supabase, student.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">My Courses</h1>
      <p className="mt-1 text-sm text-navy/60">
        Courses assigned to your account. Contact us if you think something's missing.
      </p>

      {courses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">No courses assigned yet.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.courseId} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
