import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EnrollmentRow } from "@/types/database";

export type EnrollmentCounts = {
  total: number;
  new: number;
  contacted: number;
  enrolled: number;
};

/** Same phase/level/batch/program-offer selection = the same "course choice". */
function courseSelectionKey(e: EnrollmentRow): string {
  return `${e.phase_id ?? ""}|${e.level_id ?? ""}|${e.batch_id ?? ""}|${e.program_offer_key ?? ""}`;
}

/**
 * Collapses repeat submissions of the SAME person (email + phone) for the
 * SAME course choice down to one row, so a student who double-submits (or
 * resubmits after abandoning the Interac payment) doesn't clutter the admin
 * list with near-identical entries. A second enrollment for a DIFFERENT
 * course/batch is a genuinely separate application and is kept as its own
 * row. Rows are expected pre-sorted newest-first; within a duplicate group
 * a PAID/confirmed row always wins over an unpaid one (never hide a
 * confirmed enrollment behind a later abandoned resubmission), otherwise
 * the most recent submission wins.
 */
function dedupeByContactAndCourse(enrollments: EnrollmentRow[]): EnrollmentRow[] {
  const byKey = new Map<string, EnrollmentRow>();

  for (const enrollment of enrollments) {
    const key = `${enrollment.email.trim().toLowerCase()}|${enrollment.phone.trim()}|${courseSelectionKey(enrollment)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, enrollment);
    } else if (existing.payment_status !== "PAID" && enrollment.payment_status === "PAID") {
      byKey.set(key, enrollment);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getAdminEnrollments(
  supabase: SupabaseClient<Database>
): Promise<{ enrollments: EnrollmentRow[]; counts: EnrollmentCounts }> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const enrollments = dedupeByContactAndCourse(data ?? []);
  const counts: EnrollmentCounts = {
    total: enrollments.length,
    new: enrollments.filter((e) => e.status === "NEW").length,
    contacted: enrollments.filter((e) => e.status === "CONTACTED").length,
    enrolled: enrollments.filter((e) => e.status === "ENROLLED").length,
  };

  return { enrollments, counts };
}
