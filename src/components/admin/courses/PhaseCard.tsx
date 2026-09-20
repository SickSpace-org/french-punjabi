"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { AdminPhase } from "@/lib/courses/getAdminCourseData";
import type { BatchRow } from "@/types/database";
import LevelBlock from "./LevelBlock";
import BatchList from "./BatchList";
import BatchFormModal from "./BatchFormModal";
import PhaseTextModal from "./PhaseTextModal";
import PricingEditor from "./PricingEditor";

export default function PhaseCard({ phase }: { phase: AdminPhase }) {
  const [editingPhase, setEditingPhase] = useState(false);
  const [batchModal, setBatchModal] = useState<
    { mode: "add" } | { mode: "edit"; batch: BatchRow } | null
  >(null);

  const fullPricing = phase.pricing.find((p) => p.payment_mode === "full");
  const monthlyPricing = phase.pricing.find((p) => p.payment_mode === "monthly");

  const nextDisplayOrder =
    phase.batches.reduce((max, b) => Math.max(max, b.display_order), 0) + 1;

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-red">{phase.code}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold text-navy">{phase.title}</h2>
            {phase.badge ? (
              <span className="rounded-full bg-red-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-dark">
                {phase.badge}
              </span>
            ) : null}
            {!phase.is_active ? (
              <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy/50">
                Inactive
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-navy/50">{phase.months_label}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingPhase(true)}
          className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
          Edit
        </button>
      </div>

      <p className="mt-3 text-sm text-navy/60">{phase.description}</p>

      <div className="mt-5 space-y-5">
        {phase.levels.map((level) => (
          <LevelBlock key={level.id} level={level} phaseNumber={`Phase ${phase.phase_number}`} />
        ))}

        {/* Batches sitting directly under the phase — a phase can have these
            alongside Levels (e.g. Exam Mastery: Level 1/2 plus a few
            batches never assigned a Level), not just one or the other. */}
        {phase.levels.length > 0 && phase.batches.length > 0 ? (
          <p className="border-t border-navy/8 pt-5 text-xs font-bold uppercase tracking-wide text-navy/40">
            No Level
          </p>
        ) : null}
        {phase.batches.length > 0 || phase.levels.length === 0 ? (
          <div className={phase.levels.length > 0 ? "-mt-2" : undefined}>
            <BatchList batches={phase.batches} onEdit={(batch) => setBatchModal({ mode: "edit", batch })} />
            <button
              type="button"
              onClick={() => setBatchModal({ mode: "add" })}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy/20 px-3.5 py-2 text-xs font-semibold text-navy/60 hover:border-red/30 hover:text-red"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Add Batch
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 border-t border-navy/8 pt-5">
        <PricingEditor fullRow={fullPricing} monthlyRow={monthlyPricing} />
      </div>

      {editingPhase ? <PhaseTextModal phase={phase} onClose={() => setEditingPhase(false)} /> : null}

      {batchModal ? (
        <BatchFormModal
          key={batchModal.mode === "edit" ? batchModal.batch.id : "add"}
          mode={batchModal.mode}
          parent={{ phaseId: phase.id }}
          existing={batchModal.mode === "edit" ? batchModal.batch : undefined}
          nextDisplayOrder={nextDisplayOrder}
          contextLabel={`Phase ${phase.phase_number}`}
          onClose={() => setBatchModal(null)}
        />
      ) : null}
    </div>
  );
}
