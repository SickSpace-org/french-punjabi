import { GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeacher } from "@/lib/teachers/getCurrentTeacher";
import { getTeacherDashboard } from "@/lib/teachers/getTeacherDashboard";
import TeacherDashboardClient from "@/components/teacher/TeacherDashboardClient";

export const revalidate = 0;

export default async function TeacherHomePage() {
  const supabase = await createClient();
  const teacher = await getCurrentTeacher(supabase);

  let batches: Awaited<ReturnType<typeof getTeacherDashboard>> | null = null;
  if (teacher) {
    try {
      batches = await getTeacherDashboard(supabase, teacher.id);
    } catch (error) {
      console.error("[Teacher] Failed to load dashboard:", error);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">
        Welcome{teacher ? `, ${teacher.full_name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-navy/60">
        Your assigned batches, their students, meeting link, and class recordings.
      </p>

      {!batches ? (
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">
            Couldn&apos;t load your dashboard right now. Please refresh the page.
          </p>
        </div>
      ) : batches.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <GraduationCap className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">No batches assigned yet.</p>
          <p className="mt-1 text-xs text-navy/45">Contact the AngrishFrançais admin team to get assigned.</p>
        </div>
      ) : (
        <TeacherDashboardClient batches={batches} />
      )}
    </div>
  );
}
