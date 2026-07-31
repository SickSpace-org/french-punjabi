import { createClient } from "@/lib/supabase/server";
import { getAdminContentData } from "@/lib/content/getAdminContentData";
import ContentCoursesClient from "@/components/admin/content/ContentCoursesClient";

export const revalidate = 0;

export default async function AdminContentPage() {
  const supabase = await createClient();

  let data: Awaited<ReturnType<typeof getAdminContentData>> | null = null;
  try {
    data = await getAdminContentData(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load course content:", error);
  }

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Course Content</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load course content right now. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Course Content</h1>
      <p className="mt-1 text-sm text-navy/60">
        Learning courses, weeks and lessons shown in the Student Portal — separate from pricing/batch
        management under Courses.
      </p>

      <div className="mt-8">
        <ContentCoursesClient initialCourses={data.courses} phaseOptions={data.phaseOptions} />
      </div>
    </div>
  );
}
