import { createPublicClient } from "@/lib/supabase/server";
import { sweepStaleHoldsThrottled } from "@/lib/oneOnOne/staleHolds";
import type { BatchRow, LevelRow, PhaseRow, PricingRow, ProgramOfferRow } from "@/types/database";
import type { Batch, OneOnOneSlot, Phase, PhasePricingMode, ProgramOffers, Timing } from "./types";

const BASE_BATCH_COLUMNS =
  "id, slug, name, teacher_name, time_label, timezone, note, is_tbd, availability_status, total_slots, filled_slots, display_order, is_active";
/** Added by supabase/067. Queried first, with a fallback to BASE_BATCH_COLUMNS so the site still loads if that migration hasn't been run yet. */
const BATCH_COLUMNS = `${BASE_BATCH_COLUMNS}, held_slots, is_one_on_one`;

type PhaseQueryRow = PhaseRow & {
  levels: (LevelRow & { batches: BatchRow[] })[];
  batches: BatchRow[];
  pricing: PricingRow[];
};

function formatLabel(timeLabel: string, timezone: string) {
  return timezone ? `${timeLabel} ${timezone}`.trim() : timeLabel;
}

function toTiming(row: BatchRow): Timing {
  const seatsLeft =
    row.total_slots != null ? Math.max(row.total_slots - row.filled_slots, 0) : undefined;
  return {
    id: row.id,
    label: formatLabel(row.time_label, row.timezone),
    name: row.name || undefined,
    tbd: row.is_tbd || undefined,
    note: row.note || undefined,
    status: row.availability_status === "hidden" ? "available" : row.availability_status,
    seatsLeft,
  };
}

function byDisplayOrder<T extends { display_order: number }>(a: T, b: T) {
  return a.display_order - b.display_order;
}

function toPricingMode(row: PricingRow | undefined): PhasePricingMode {
  if (!row) return { base: 0, taxRate: 0, total: 0 };
  return {
    base: Number(row.base_price),
    taxRate: Number(row.tax_rate),
    total: Number(row.display_total),
    duration: row.duration_label ?? undefined,
  };
}

/** Group-class timings only: private one-on-one slots have their own section. */
function visibleBatches(rows: BatchRow[]) {
  return rows
    .filter((row) => row.is_active && row.availability_status !== "hidden" && !row.is_one_on_one)
    .sort(byDisplayOrder);
}

/**
 * A one-on-one slot is open until someone reserves it. Reserving sets
 * availability_status to "full" and holds the seat (held_slots) until the
 * admin confirms payment (filled_slots) or reopens the slot, so all three
 * are checked.
 */
export function isOneOnOneSlotOpen(row: Pick<BatchRow, "is_active" | "availability_status" | "total_slots" | "filled_slots" | "held_slots">) {
  return (
    row.is_active &&
    row.availability_status !== "hidden" &&
    row.availability_status !== "full" &&
    (row.total_slots ?? 1) - row.filled_slots - row.held_slots > 0
  );
}

function oneOnOneSlots(rows: BatchRow[]): OneOnOneSlot[] {
  return rows
    .filter((row) => row.is_one_on_one && row.is_active && row.availability_status !== "hidden")
    .sort(byDisplayOrder)
    .map((row) => ({
      id: row.id,
      label: formatLabel(row.time_label, row.timezone),
      teacher: row.teacher_name ?? undefined,
      open: isOneOnOneSlotOpen(row),
    }));
}

/**
 * Phase 3 (Exam Mastery) is shown as two exam tracks rather than by the
 * database levels: Level 1 = every TEF batch, Level 2 = every TCF batch.
 * A batch counts as TCF when "TCF" appears in its own or its level’s name;
 * everything else (TEF batches, Hitesh Batch) is TEF.
 */
const EXAM_MASTERY_PHASE = 3;

function groupByExam(levelBatches: { levelName: string; row: BatchRow }[]): Batch[] {
  const isTcf = (b: { levelName: string; row: BatchRow }) =>
    /tcf/i.test(b.row.name ?? "") || /tcf/i.test(b.levelName);
  const tracks = [
    { id: "exam-mastery-level-1-tef", title: "Level 1 · TEF Canada", pick: (b: { levelName: string; row: BatchRow }) => !isTcf(b) },
    { id: "exam-mastery-level-2-tcf", title: "Level 2 · TCF Canada", pick: isTcf },
  ];
  return tracks.map((track) => ({
    id: track.id,
    title: track.title,
    timings: levelBatches
      .filter(track.pick)
      .map((b) => b.row)
      .sort(byDisplayOrder)
      .map(toTiming),
  }));
}

function toPhase(row: PhaseQueryRow): Phase {
  const levelBatches: Batch[] = [...row.levels]
    .filter((level) => level.is_active)
    .sort(byDisplayOrder)
    .map((level) => ({
      id: level.slug,
      title: level.name,
      teacher: level.teacher_name ?? undefined,
      timings: visibleBatches(level.batches).map(toTiming),
    }));

  const directBatches: Batch[] = visibleBatches(row.batches).map((batch) => ({
    id: batch.slug ?? batch.id,
    title: batch.name ?? "",
    teacher: batch.teacher_name ?? undefined,
    timings: [toTiming(batch)],
  }));

  const batches =
    row.phase_number === EXAM_MASTERY_PHASE
      ? groupByExam([
          ...row.levels
            .filter((level) => level.is_active)
            .flatMap((level) => visibleBatches(level.batches).map((b) => ({ levelName: level.name, row: b }))),
          ...visibleBatches(row.batches).map((b) => ({ levelName: "", row: b })),
        ])
      : [...levelBatches, ...directBatches];

  const pricingByMode = new Map(row.pricing.map((p) => [p.payment_mode, p]));

  return {
    id: row.slug,
    number: `Phase ${row.phase_number}`,
    code: row.code,
    title: row.title,
    months: row.months_label,
    badge: row.badge ?? undefined,
    description: row.description,
    batches,
    oneOnOneSlots: oneOnOneSlots(row.batches),
    dbId: row.id,
    pricing: {
      full: toPricingMode(pricingByMode.get("full")),
      monthly: toPricingMode(pricingByMode.get("monthly")),
    },
  };
}

function toProgramOffers(rows: ProgramOfferRow[]): ProgramOffers {
  const offers: ProgramOffers = {};
  for (const row of rows) {
    // The old Calendly one-on-one was retired; its row is kept only for history.
    if (!row.is_active || row.key === "one_on_one_testing") continue;
    offers[row.key] = {
      label: row.label,
      base: Number(row.base_price),
      total: row.display_total != null ? Number(row.display_total) : undefined,
      taxRate: row.tax_rate != null ? Number(row.tax_rate) : undefined,
      duration: row.duration_label ?? undefined,
    };
  }
  return offers;
}

function queryPhases(supabase: ReturnType<typeof createPublicClient>, batchColumns: string) {
  return supabase
    .from("phases")
    .select(
      `id, slug, phase_number, code, title, months_label, badge, description, display_order, is_active,
       levels ( id, phase_id, slug, name, subtitle, teacher_name, display_order, is_active, batches ( ${batchColumns} ) ),
       batches ( ${batchColumns} ),
       pricing ( id, phase_id, payment_mode, base_price, tax_rate, display_total, currency, duration_label, is_active )`
    )
    .eq("is_active", true);
}

export async function getPublicCourses(): Promise<{
  phases: Phase[];
  programOffers: ProgramOffers;
}> {
  const supabase = createPublicClient();

  // Frees one-on-one slots that were reserved but never paid for. Throttled to
  // once per 10 minutes per server and never throws, so it can't slow or break
  // this page; the daily cron does the same job as a backstop.
  await sweepStaleHoldsThrottled();

  const [phasesAttempt, offersResult] = await Promise.all([
    queryPhases(supabase, BATCH_COLUMNS),
    supabase.from("program_offers").select("*"),
  ]);

  // supabase/067 not run yet: the new columns don't exist (Postgres 42703), so
  // read the pre-migration shape. One-on-one simply doesn't show until it is.
  const phasesResult = phasesAttempt.error?.code === "42703" ? await queryPhases(supabase, BASE_BATCH_COLUMNS) : phasesAttempt;

  if (phasesResult.error) throw phasesResult.error;
  if (offersResult.error) throw offersResult.error;

  const phases = ((phasesResult.data ?? []) as unknown as PhaseQueryRow[])
    .sort(byDisplayOrder)
    .map(toPhase);

  const programOffers = toProgramOffers((offersResult.data ?? []) as ProgramOfferRow[]);

  return { phases, programOffers };
}
