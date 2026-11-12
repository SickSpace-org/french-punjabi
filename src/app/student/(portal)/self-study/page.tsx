import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStudentSelfStudy, SelfStudyTableMissingError } from "@/lib/selfStudy/getSelfStudy";
import { purgeExpiredSelfStudyThrottled } from "@/lib/selfStudy/cleanup";
import StudentSelfStudy from "@/components/selfStudy/StudentSelfStudy";

export const revalidate = 0;

export default async function StudentSelfStudyPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null; // layout guard already handles this — defensive only

  after(purgeExpiredSelfStudyThrottled);

  let data: Awaited<ReturnType<typeof getStudentSelfStudy>> | null = null;
  try {
    data = await getStudentSelfStudy(supabase);
  } catch (error) {
    if (!(error instanceof SelfStudyTableMissingError)) console.error("[Student] Failed to load self study:", error);
  }

  if (!data) {
    return (
      <div>
        <p className="font-display text-2xl font-bold text-navy">Self Study</p>
        <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">Self Study isn&apos;t available right now. Please try again later.</p>
        </div>
      </div>
    );
  }

  return <StudentSelfStudy studentId={student.id} assignments={data.assignments} submissions={data.submissions} />;
}
