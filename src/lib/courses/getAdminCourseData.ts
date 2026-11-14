import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BatchRow,
  Database,
  LevelRow,
  PhaseRow,
  PricingRow,
  ProgramOfferRow,
} from "@/types/database";
import { formatBatchTiming } from "./batchLabel";
import { getOneOnOneHolders } from "@/lib/oneOnOne/holders";

const BASE_BATCH_COLUMNS =
  "id, phase_id, level_id, slug, name, teacher_name, teacher_id, time_label, timezone, note, is_tbd, availability_status, total_slots, filled_slots, display_order, is_active, meeting_link, class_days, class_time, created_at, updated_at";
// One-on-one slots need these two to be told apart and to tell which are in use.
const ONE_ON_ONE_COLUMNS = ", held_slots, is_one_on_one";

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
  const loadPhases = (batchColumns: string) =>
    supabase
      .from("phases")
      .select(
        `*,
         levels ( *, batches ( ${batchColumns} ) ),
         batches ( ${batchColumns} ),
         pricing ( * )`
      )
      .order("display_order");

  const [firstPhases, offersResult] = await Promise.all([
    loadPhases(BASE_BATCH_COLUMNS + ONE_ON_ONE_COLUMNS),
    supabase.from("program_offers").select("*"),
  ]);
  // 42703 = undefined column: the one-on-one migration (067) hasn't been run yet.
  const phasesResult = firstPhases.error?.code === "42703" ? await loadPhases(BASE_BATCH_COLUMNS) : firstPhases;

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
export type BatchOptionSettings = {
  /** Student name per in-use one-on-one slot, from getOneOnOneHolders. */
  holders?: Map<string, string>;
  /** Leave out one-on-one slots nobody has reserved. For sharing content, where an empty slot is never a target. */
  hideUnusedOneOnOne?: boolean;
};

/** Label for a batch in a picker. One-on-one slots end with the student's name, or "open". */
export function labelBatchOption(
  phaseTitle: string,
  levelName: string | null,
  batch: Pick<BatchRow, "id" | "name" | "time_label" | "timezone"> & { is_one_on_one?: boolean },
  holders?: Map<string, string>
): string {
  const base = [phaseTitle, levelName, formatBatchTiming(batch)].filter(Boolean).join(" — ");
  return batch.is_one_on_one ? `${base} — ${holders?.get(batch.id) ?? "open"}` : base;
}

/** The ids of every one-on-one slot in use, so their holders' names can be looked up. */
export function inUseOneOnOneIds(phases: AdminPhase[]): string[] {
  const ids: string[] = [];
  const consider = (b: BatchRow) => {
    if (b.is_one_on_one && (b.held_slots > 0 || b.filled_slots > 0)) ids.push(b.id);
  };
  for (const phase of phases) {
    phase.batches.forEach(consider);
    for (const level of phase.levels) level.batches.forEach(consider);
  }
  return ids;
}

/** getActiveBatchOptions, with one-on-one slots labelled by the student in them. */
export async function getBatchOptionsWithHolders(
  supabase: SupabaseClient<Database>,
  phases: AdminPhase[],
  settings: Pick<BatchOptionSettings, "hideUnusedOneOnOne"> = {}
) {
  const holders = await getOneOnOneHolders(supabase, inUseOneOnOneIds(phases));
  return { holders, options: getActiveBatchOptions(phases, { ...settings, holders }) };
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
export function getActiveBatchOptions(
  phases: AdminPhase[],
  settings: BatchOptionSettings = {}
): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [];
  const skip = (b: BatchRow) =>
    !b.is_active || (settings.hideUnusedOneOnOne && b.is_one_on_one && b.held_slots === 0 && b.filled_slots === 0);
  for (const phase of phases) {
    if (!phase.is_active) continue;
    for (const batch of phase.batches) {
      if (skip(batch)) continue;
      options.push({ id: batch.id, label: labelBatchOption(phase.title, null, batch, settings.holders) });
    }
    for (const level of phase.levels) {
      if (!level.is_active) continue;
      for (const batch of level.batches) {
        if (skip(batch)) continue;
        options.push({ id: batch.id, label: labelBatchOption(phase.title, level.name, batch, settings.holders) });
      }
    }
  }
  return options;
}
