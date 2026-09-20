import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BatchRow, Database } from "@/types/database";
import { getAdminCourseData } from "@/lib/courses/getAdminCourseData";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import {
  createBatch as createBatchAction,
  updatePhaseText as updatePhaseTextAction,
  updateLevelText as updateLevelTextAction,
  updateBatchStatus as updateBatchStatusAction,
  setBatchActive as setBatchActiveAction,
  updatePricing as updatePricingAction,
  updateProgramOffer as updateProgramOfferAction,
  type BatchFormInput,
} from "@/app/admin/(dashboard)/courses/actions";
import { swapBatch as swapBatchAction, type SwapTarget } from "@/app/admin/(dashboard)/swap-batches/actions";

const AVAILABILITY_STATUSES = ["available", "almost_full", "full", "hidden"] as const;

/** Course/batch management tools — everything under the admin Courses and Swap Batches pages. */
export function buildCourseTools(supabase: SupabaseClient<Database>) {
  return {
    listCourseTree: tool({
      description:
        "List every Phase, Level, and Batch (with ids, names, current timing, and pricing) so you can look up the right id before creating, editing, or swapping a batch, or resolving what the admin means by a name like 'Level 2' or 'October batch'.",
      inputSchema: z.object({}),
      execute: async () => {
        const { phases, programOffers } = await getAdminCourseData(supabase);
        return {
          phases: phases.map((phase) => ({
            phaseId: phase.id,
            title: phase.title,
            isActive: phase.is_active,
            pricing: phase.pricing.map((p) => ({
              pricingId: p.id,
              paymentMode: p.payment_mode,
              basePrice: p.base_price,
              displayTotal: p.display_total,
            })),
            levels: phase.levels.map((level) => ({
              levelId: level.id,
              name: level.name,
              isActive: level.is_active,
              batches: level.batches.map((b) => ({
                batchId: b.id,
                label: formatBatchTiming(b),
                isActive: b.is_active,
                availabilityStatus: b.availability_status,
              })),
            })),
            directBatches: phase.batches.map((b) => ({
              batchId: b.id,
              label: formatBatchTiming(b),
              isActive: b.is_active,
              availabilityStatus: b.availability_status,
            })),
          })),
          programOffers: programOffers.map((o) => ({
            offerId: o.id,
            key: o.key,
            label: o.label,
            basePrice: o.base_price,
            displayTotal: o.display_total,
          })),
        };
      },
    }),

    updatePhaseName: tool({
      description: "Rename a Phase's title or edit its code/months label/badge/description. Only pass fields that should change.",
      inputSchema: z.object({
        phaseId: z.string(),
        title: z.string().optional(),
        code: z.string().optional(),
        monthsLabel: z.string().optional(),
        badge: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ phaseId, ...fields }) => {
        const { data: current, error } = await supabase
          .from("phases")
          .select("title, code, months_label, badge, description")
          .eq("id", phaseId)
          .maybeSingle();
        if (error || !current) return { ok: false, error: "Phase not found." };
        return updatePhaseTextAction(phaseId, {
          title: fields.title ?? current.title,
          code: fields.code ?? current.code,
          monthsLabel: fields.monthsLabel ?? current.months_label,
          badge: fields.badge ?? current.badge ?? "",
          description: fields.description ?? current.description,
        });
      },
    }),

    updateLevelName: tool({
      description: "Rename a Level or edit its subtitle/teacher name. Only pass fields that should change.",
      inputSchema: z.object({
        levelId: z.string(),
        name: z.string().optional(),
        subtitle: z.string().optional(),
        teacherName: z.string().optional(),
      }),
      execute: async ({ levelId, ...fields }) => {
        const { data: current, error } = await supabase
          .from("levels")
          .select("name, subtitle, teacher_name")
          .eq("id", levelId)
          .maybeSingle();
        if (error || !current) return { ok: false, error: "Level not found." };
        return updateLevelTextAction(levelId, {
          name: fields.name ?? current.name,
          subtitle: fields.subtitle ?? current.subtitle ?? "",
          teacherName: fields.teacherName ?? current.teacher_name ?? "",
        });
      },
    }),

    createBatch: tool({
      description:
        "Create a new batch (a specific timing students can enroll into) under an existing Phase or an existing Level. Call listCourseTree first to get the phaseId or levelId. Provide exactly one of phaseId or levelId.",
      inputSchema: z.object({
        phaseId: z.string().optional().describe("Set this to add the batch directly under a Phase (only valid for a phase with no Levels)."),
        levelId: z.string().optional().describe("Set this to add the batch under a specific Level."),
        name: z.string().optional().describe("Optional custom batch name, e.g. 'October Batch'."),
        timeLabel: z.string().describe("e.g. '8:00 PM'"),
        timezone: z.string().default("EST"),
        teacherName: z.string().optional(),
        note: z.string().optional(),
        isTbd: z.boolean().default(false),
        totalSlots: z.number().int().positive().optional(),
      }),
      execute: async (input) => {
        if (!input.phaseId && !input.levelId) {
          return { ok: false, error: "You must provide either phaseId or levelId." };
        }
        if (input.phaseId && input.levelId) {
          return { ok: false, error: "Provide only one of phaseId or levelId, not both." };
        }
        const parent = input.levelId ? { levelId: input.levelId } : { phaseId: input.phaseId! };
        const { data: siblings, error: siblingError } = await supabase
          .from("batches")
          .select("display_order")
          .match(input.levelId ? { level_id: input.levelId } : { phase_id: input.phaseId });
        if (siblingError) return { ok: false, error: siblingError.message };
        const nextDisplayOrder = (siblings ?? []).reduce((max, b) => Math.max(max, b.display_order), 0) + 1;

        const formInput: BatchFormInput = {
          name: input.name ?? "",
          teacherName: input.teacherName ?? "",
          timeLabel: input.timeLabel,
          timezone: input.timezone,
          note: input.note ?? "",
          isTbd: input.isTbd,
          availabilityStatus: "available",
          totalSlots: input.totalSlots ?? null,
          filledSlots: 0,
          displayOrder: nextDisplayOrder,
        };
        return createBatchAction(parent, formInput);
      },
    }),

    editBatch: tool({
      description:
        "Edit fields on an EXISTING batch: rename it, change its time/timezone/teacher/note, mark time-to-be-confirmed, change total seats, set its availability (available/almost_full/full/hidden), or activate/deactivate it. Only pass the fields that should change. Call listCourseTree first to find the batchId.",
      inputSchema: z.object({
        batchId: z.string(),
        name: z.string().optional(),
        timeLabel: z.string().optional(),
        timezone: z.string().optional(),
        teacherName: z.string().optional(),
        note: z.string().optional(),
        isTbd: z.boolean().optional(),
        totalSlots: z.number().int().positive().optional(),
        availabilityStatus: z.enum(AVAILABILITY_STATUSES).optional(),
        isActive: z.boolean().optional().describe("Set false to hide this batch from the active list (e.g. it's full/finished) — doesn't delete it."),
      }),
      execute: async (input) => {
        const { batchId, availabilityStatus, isActive, ...fields } = input;
        const updates: Partial<Omit<BatchRow, "id" | "created_at" | "updated_at">> = {};
        if (fields.name !== undefined) updates.name = fields.name || null;
        if (fields.timeLabel !== undefined) updates.time_label = fields.timeLabel;
        if (fields.timezone !== undefined) updates.timezone = fields.timezone;
        if (fields.teacherName !== undefined) updates.teacher_name = fields.teacherName || null;
        if (fields.note !== undefined) updates.note = fields.note || null;
        if (fields.isTbd !== undefined) updates.is_tbd = fields.isTbd;
        if (fields.totalSlots !== undefined) updates.total_slots = fields.totalSlots;

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase.from("batches").update(updates).eq("id", batchId);
          if (error) return { ok: false, error: error.message };
        }
        if (availabilityStatus !== undefined) {
          const result = await updateBatchStatusAction(batchId, availabilityStatus);
          if (!result.ok) return result;
        }
        if (isActive !== undefined) {
          const result = await setBatchActiveAction(batchId, isActive);
          if (!result.ok) return result;
        }
        if (Object.keys(updates).length === 0 && availabilityStatus === undefined && isActive === undefined) {
          return { ok: false, error: "No fields to update were provided." };
        }
        return { ok: true };
      },
    }),

    swapBatch: tool({
      description:
        "Move every currently enrolled student out of an old batch onto a fresh new batch, in one action — e.g. 'move everyone in the October batch to Level 2', 'swap TCF Native into a brand new Level 2', or 'move this batch's students into the TEF/TCF Preparation phase' (a full Phase change is allowed, not just a different Level of the same Phase). Creates the new batch, moves the students, and archives the old batch (keeps its attendance history). Call listCourseTree first to find the batchId, the target phaseId, and (if targeting an existing level) the levelId.",
      inputSchema: z.object({
        oldBatchId: z.string(),
        target: z
          .discriminatedUnion("type", [
            z.object({ type: z.literal("existing"), levelId: z.string() }).describe("An existing Level, in any phase — the level's own phase determines the target phase."),
            z.object({ type: z.literal("none"), phaseId: z.string() }).describe("Keep the new batch directly under this phase, no Level."),
            z.object({ type: z.literal("new"), name: z.string(), phaseId: z.string() }).describe("Create a brand-new Level with this name under this phase first."),
          ])
          .describe("Where the new batch should live — can be a different Phase entirely, not just a different Level."),
        name: z.string().optional().describe("New batch's name — defaults to the old batch's own name if omitted."),
        timeLabel: z.string().optional().describe("Defaults to the old batch's own time if omitted."),
        timezone: z.string().optional(),
        teacherName: z.string().optional(),
        note: z.string().optional(),
        isTbd: z.boolean().optional(),
        totalSlots: z.number().int().positive().optional(),
      }),
      execute: async (input) => {
        const { data: oldBatch, error: oldBatchError } = await supabase
          .from("batches")
          .select("name, time_label, timezone, teacher_name, note, is_tbd, total_slots")
          .eq("id", input.oldBatchId)
          .maybeSingle();
        if (oldBatchError || !oldBatch) return { ok: false, error: "Old batch not found." };

        const target: SwapTarget = input.target as SwapTarget;
        return swapBatchAction(input.oldBatchId, target, {
          name: input.name ?? oldBatch.name ?? "",
          teacherName: input.teacherName ?? oldBatch.teacher_name ?? "",
          timeLabel: input.timeLabel ?? oldBatch.time_label,
          timezone: input.timezone ?? oldBatch.timezone,
          note: input.note ?? oldBatch.note ?? "",
          isTbd: input.isTbd ?? oldBatch.is_tbd,
          availabilityStatus: "available",
          totalSlots: input.totalSlots ?? oldBatch.total_slots,
        });
      },
    }),

    updatePricing: tool({
      description: "Update a Phase's price for a given payment mode (full or monthly) — call listCourseTree first to get the pricingId.",
      inputSchema: z.object({
        pricingId: z.string(),
        basePrice: z.number().positive(),
        taxRate: z.number().min(0).max(1).describe("e.g. 0.13 for 13%"),
        displayTotal: z.number().positive(),
        durationLabel: z.string().optional(),
      }),
      execute: async (input) =>
        updatePricingAction(input.pricingId, {
          basePrice: input.basePrice,
          taxRate: input.taxRate,
          displayTotal: input.displayTotal,
          durationLabel: input.durationLabel ?? "",
        }),
    }),

    updateProgramOffer: tool({
      description: "Update a program offer's (e.g. Complete Program, Redo a Month) price or label — call listCourseTree first to get the offerId.",
      inputSchema: z.object({
        offerId: z.string(),
        label: z.string().optional(),
        basePrice: z.number().positive().optional(),
        taxRate: z.number().min(0).max(1).optional(),
        displayTotal: z.number().positive().optional(),
        durationLabel: z.string().optional(),
      }),
      execute: async ({ offerId, ...fields }) => {
        const { data: current, error } = await supabase
          .from("program_offers")
          .select("label, base_price, tax_rate, display_total, duration_label")
          .eq("id", offerId)
          .maybeSingle();
        if (error || !current) return { ok: false, error: "Program offer not found." };
        return updateProgramOfferAction(offerId, {
          label: fields.label ?? current.label,
          basePrice: fields.basePrice ?? current.base_price,
          taxRate: fields.taxRate ?? current.tax_rate ?? 0,
          displayTotal: fields.displayTotal ?? current.display_total ?? current.base_price,
          durationLabel: fields.durationLabel ?? current.duration_label ?? "",
        });
      },
    }),
  };
}
