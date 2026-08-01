import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getMyCourses } from "@/lib/student/getCourses";
import { getStudentNotifications } from "@/lib/student/getNotifications";
import CourseCard from "@/components/student/CourseCard";

export const revalidate = 0;

export default async function StudentDashboardPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null; // layout guard already handles this — defensive only

  const [courses, notifications] = await Promise.all([
    getMyCourses(supabase, student.id),
    getStudentNotifications(supabase, student.id),
  ]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const firstName = student.full_name.split(" ")[0] || student.full_name;

  return (
    <div>
      <p className="font-display text-2xl font-bold text-navy">Bonjour, {firstName}</p>
      <p className="mt-1 text-sm text-navy/60">Welcome back to AngrishFrançais.</p>

      {unreadCount > 0 ? (
        <Link
          href="/student/notifications"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:border-red/30 hover:text-red-dark"
        >
          <Bell className="h-4 w-4 text-red" strokeWidth={2} />
          {unreadCount} new {unreadCount === 1 ? "notification" : "notifications"}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      ) : null}

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">My Courses</p>

        {courses.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-12 text-center">
            <p className="text-sm font-medium text-navy/60">
              No courses assigned yet. Once your enrollment is confirmed and a course is assigned,
              it will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {courses.map((course) => (
              <CourseCard key={course.courseId} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
