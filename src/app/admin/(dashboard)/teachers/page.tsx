import { createClient } from "@/lib/supabase/server";
import { getAdminTeachers } from "@/lib/teachers/getAdminTeachers";
import TeachersClient from "@/components/admin/teachers/TeachersClient";

export const revalidate = 0;

export default async function AdminTeachersPage() {
  const supabase = await createClient();

  let teachers: Awaited<ReturnType<typeof getAdminTeachers>> | null = null;
  try {
    teachers = await getAdminTeachers(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load teachers:", error);
  }

  if (!teachers) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Teachers</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load teachers right now. Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return <TeachersClient initialTeachers={teachers} />;
}
