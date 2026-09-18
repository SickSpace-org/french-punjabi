import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BatchRow,
  Database,
  LevelRow,
  PhaseRow,
  PricingRow,
  ProgramOfferRow,
} from "@/types/database";

const BATCH_COLUMNS =
  "id, phase_id, level_id, slug, name, teacher_name, time_label, timezone, note, is_tbd, availability_status, total_slots, filled_slots, display_order, is_active, meeting_link, class_days, class_time, created_at, updated_at";

export type AdminLevel = LevelRow & { batches: BatchRow[] };
export type AdminPhase = PhaseRow & {
  levels: AdminLevel[];
  batches: BatchRow[];
  pricing: PricingRow[];
};

function byDisplayOrder<T extends { display_order: number }>(a: T, b: T) {
  return a.display_order - b.display_order;
}

/**
 * Full course tree for the admin UI — unlike getPublicCourses, this
 * includes inactive phases/levels and hidden/inactive batches, and keeps
 * raw fields (time_label/timezone separately, raw availability_status)
 * instead of the combined public display shape. Relies on the caller's
 * session (via `supabase`) being an approved admin — RLS on every table
 * quietly falls back to public-only rows otherwise.
 */
export async function getAdminCourseData(supabase: SupabaseClient<Database>) {
  const [phasesResult, offersResult] = await Promise.all([
    supabase
      .from("phases")
      .select(
        `*,
         levels ( *, batches ( ${BATCH_COLUMNS} ) ),
         batches ( ${BATCH_COLUMNS} ),
         pricing ( * )`
      )
      .order("display_order"),
    supabase.from("program_offers").select("*"),
  ]);

  if (phasesResult.error) throw phasesResult.error;
  if (offersResult.error) throw offersResult.error;

  const phases = (
    (phasesResult.data ?? []) as unknown as AdminPhase[]
  ).map((phase) => ({
    ...phase,
    levels: [...phase.levels]
      .sort(byDisplayOrder)
      .map((level) => ({ ...level, batches: [...level.batches].sort(byDisplayOrder) })),
    batches: [...phase.batches].sort(byDisplayOrder),
    pricing: [...phase.pricing].sort((a, b) => a.payment_mode.localeCompare(b.payment_mode)),
  }));

  const programOffers = ((offersResult.data ?? []) as ProgramOfferRow[]).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  return { phases, programOffers };
}

/**
 * Batch options for a "which course is this student in" picker — ONLY
 * active phase/level/batch combinations, unlike the full admin tree above
 * (which deliberately keeps inactive rows visible for the Courses page
 * itself to manage/reactivate them). Deactivating a batch in Courses is
 * this app's only "remove a course" action today (there's no hard delete),
 * so a deactivated batch must stop being an assignable option here even
 * though it still exists in the database.
 */
export function getActiveBatchOptions(phases: AdminPhase[]): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [];
  for (const phase of phases) {
    if (!phase.is_active) continue;
    for (const batch of phase.batches) {
      if (!batch.is_active) continue;
      const batchLabel = batch.name ? `${batch.name} — ${batch.time_label}` : batch.time_label;
      options.push({ id: batch.id, label: `${phase.title} — ${batchLabel}` });
    }
    for (const level of phase.levels) {
      if (!level.is_active) continue;
      for (const batch of level.batches) {
        if (!batch.is_active) continue;
        options.push({ id: batch.id, label: `${phase.title} — ${level.name} — ${batch.time_label}` });
      }
    }
  }
  return options;
}
