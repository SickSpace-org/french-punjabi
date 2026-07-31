import { createClient } from "@/lib/supabase/server";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import CoursesAdminClient from "./CoursesAdminClient";

export default async function AdminCoursesPage() {
  const supabase = await createClient();
  const { phases, programOffers } = await getAdminCourseData(supabase);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Course Management</h1>
      <p className="mt-1 text-sm text-navy/60">
        Manage phases, levels, batch timings, availability and pricing.
      </p>

      <div className="mt-8">
        <CoursesAdminClient initialPhases={phases} initialProgramOffers={programOffers} />
      </div>
    </div>
  );
}
