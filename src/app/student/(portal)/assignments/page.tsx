import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { AssignmentsTableMissingError, getStudentAssignments } from "@/lib/assignments/getAssignments";
import { purgeExpiredAssignmentsThrottled } from "@/lib/assignments/cleanup";
import StudentAssignments from "@/components/assignments/StudentAssignments";

export const revalidate = 0;

export default async function StudentAssignmentsPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null; // layout guard already handles this — defensive only

  after(purgeExpiredAssignmentsThrottled);

  let data: Awaited<ReturnType<typeof getStudentAssignments>> | null = null;
  try {
    data = await getStudentAssignments(supabase);
  } catch (error) {
    if (!(error instanceof AssignmentsTableMissingError)) console.error("[Student] Failed to load assignments:", error);
  }

  if (!data) {
    return (
      <div>
        <p className="font-display text-2xl font-bold text-navy">Assignments</p>
        <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">Assignments aren&apos;t available right now. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <StudentAssignments
      studentId={student.id}
      assignments={data.assignments}
      earlierSubmissions={data.earlierSubmissions}
    />
  );
}
