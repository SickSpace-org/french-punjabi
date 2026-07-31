import { createClient } from "@/lib/supabase/server";
import { getAdminEnrollments } from "@/lib/courses/getAdminEnrollments";
import EnrollmentsClient from "@/components/admin/enrollments/EnrollmentsClient";

export const revalidate = 0;

export default async function AdminEnrollmentsPage() {
  const supabase = await createClient();

  let data: Awaited<ReturnType<typeof getAdminEnrollments>> | null = null;
  try {
    data = await getAdminEnrollments(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load enrollments:", error);
  }

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Enrollments</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load enrollments right now. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return <EnrollmentsClient initialEnrollments={data.enrollments} initialCounts={data.counts} />;
}
