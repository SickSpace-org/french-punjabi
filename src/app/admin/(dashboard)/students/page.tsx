import { createClient } from "@/lib/supabase/server";
import { getAdminStudents } from "@/lib/courses/getAdminStudents";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import StudentsClient, { type BatchOption } from "@/components/admin/students/StudentsClient";

export const revalidate = 0;

export default async function AdminStudentsPage() {
  const supabase = await createClient();

  let students: Awaited<ReturnType<typeof getAdminStudents>> | null = null;
  let batchOptions: BatchOption[] = [];
  try {
    const [studentsResult, courseData] = await Promise.all([
      getAdminStudents(supabase),
      getAdminCourseData(supabase),
    ]);
    students = studentsResult;

    for (const phase of courseData.phases) {
      for (const batch of phase.batches) {
        const batchLabel = batch.name ? `${batch.name} — ${batch.time_label}` : batch.time_label;
        batchOptions.push({ id: batch.id, label: `${phase.title} — ${batchLabel}` });
      }
      for (const level of phase.levels) {
        for (const batch of level.batches) {
          batchOptions.push({ id: batch.id, label: `${phase.title} — ${level.name} — ${batch.time_label}` });
        }
      }
    }
  } catch (error) {
    console.error("[Admin] Failed to load students:", error);
  }

  if (!students) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Students</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load students right now. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return <StudentsClient initialStudents={students} batchOptions={batchOptions} />;
}
