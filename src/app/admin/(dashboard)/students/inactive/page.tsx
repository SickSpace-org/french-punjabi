import { createClient } from "@/lib/supabase/server";
import { getAdminStudents } from "@/lib/courses/getAdminStudents";
import { getAdminCourseData, getActiveBatchOptions } from "@/lib/courses/getAdminCourseData";
import InactiveStudentsClient from "@/components/admin/students/InactiveStudentsClient";
import type { BatchOption } from "@/components/admin/students/StudentsTable";

export const revalidate = 0;

export default async function AdminInactiveStudentsPage() {
  const supabase = await createClient();

  let students: Awaited<ReturnType<typeof getAdminStudents>> | null = null;
  let batchOptions: BatchOption[] = [];
  try {
    const [studentsResult, courseData] = await Promise.all([
      getAdminStudents(supabase),
      getAdminCourseData(supabase),
    ]);
    students = studentsResult.filter((s) => s.status === "INACTIVE");
    batchOptions = getActiveBatchOptions(courseData.phases);
  } catch (error) {
    console.error("[Admin] Failed to load inactive students:", error);
  }

  if (!students) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Inactive Students</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load students right now. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return <InactiveStudentsClient initialStudents={students} batchOptions={batchOptions} />;
}
