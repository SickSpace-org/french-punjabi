import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EnrollmentRow } from "@/types/database";

export type EnrollmentCounts = {
  total: number;
  new: number;
  contacted: number;
  enrolled: number;
};

export async function getAdminEnrollments(
  supabase: SupabaseClient<Database>
): Promise<{ enrollments: EnrollmentRow[]; counts: EnrollmentCounts }> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const enrollments = data ?? [];
  const counts: EnrollmentCounts = {
    total: enrollments.length,
    new: enrollments.filter((e) => e.status === "NEW").length,
    contacted: enrollments.filter((e) => e.status === "CONTACTED").length,
    enrolled: enrollments.filter((e) => e.status === "ENROLLED").length,
  };

  return { enrollments, counts };
}
