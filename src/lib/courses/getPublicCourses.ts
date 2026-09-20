import { createPublicClient } from "@/lib/supabase/server";
import type { BatchRow, LevelRow, PhaseRow, PricingRow, ProgramOfferRow } from "@/types/database";
import type { Batch, Phase, PhasePricingMode, ProgramOffers, Timing } from "./types";

const BATCH_COLUMNS =
  "id, slug, name, teacher_name, time_label, timezone, note, is_tbd, availability_status, total_slots, filled_slots, display_order, is_active";

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

function visibleBatches(rows: BatchRow[]) {
  return rows
    .filter((row) => row.is_active && row.availability_status !== "hidden")
    .sort(byDisplayOrder);
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

  const pricingByMode = new Map(row.pricing.map((p) => [p.payment_mode, p]));

  return {
    id: row.slug,
    number: `Phase ${row.phase_number}`,
    code: row.code,
    title: row.title,
    months: row.months_label,
    badge: row.badge ?? undefined,
    description: row.description,
    batches: [...levelBatches, ...directBatches],
    pricing: {
      full: toPricingMode(pricingByMode.get("full")),
      monthly: toPricingMode(pricingByMode.get("monthly")),
    },
  };
}

function toProgramOffers(rows: ProgramOfferRow[]): ProgramOffers {
  const offers: ProgramOffers = {};
  for (const row of rows) {
    if (!row.is_active) continue;
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

export async function getPublicCourses(): Promise<{
  phases: Phase[];
  programOffers: ProgramOffers;
}> {
  const supabase = createPublicClient();

  const [phasesResult, offersResult] = await Promise.all([
    supabase
      .from("phases")
      .select(
        `id, slug, phase_number, code, title, months_label, badge, description, display_order, is_active,
         levels ( id, phase_id, slug, name, subtitle, teacher_name, display_order, is_active, batches ( ${BATCH_COLUMNS} ) ),
         batches ( ${BATCH_COLUMNS} ),
         pricing ( id, phase_id, payment_mode, base_price, tax_rate, display_total, currency, duration_label, is_active )`
      )
      .eq("is_active", true),
    supabase.from("program_offers").select("*"),
  ]);

  if (phasesResult.error) throw phasesResult.error;
  if (offersResult.error) throw offersResult.error;

  const phases = ((phasesResult.data ?? []) as unknown as PhaseQueryRow[])
    .sort(byDisplayOrder)
    .map(toPhase);

  const programOffers = toProgramOffers((offersResult.data ?? []) as ProgramOfferRow[]);

  return { phases, programOffers };
}
