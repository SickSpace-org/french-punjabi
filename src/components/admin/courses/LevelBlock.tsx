"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { AdminLevel } from "@/lib/courses/getAdminCourseData";
import type { BatchRow } from "@/types/database";
import BatchRowComponent from "./BatchRow";
import BatchFormModal from "./BatchFormModal";
import LevelTextModal from "./LevelTextModal";

export default function LevelBlock({ level, phaseNumber }: { level: AdminLevel; phaseNumber: string }) {
  const [editingLevel, setEditingLevel] = useState(false);
  const [batchModal, setBatchModal] = useState<
    { mode: "add" } | { mode: "edit"; batch: BatchRow } | null
  >(null);

  const nextDisplayOrder =
    level.batches.reduce((max, b) => Math.max(max, b.display_order), 0) + 1;

  return (
    <div className="border-t border-navy/8 pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-wide text-navy">
            {level.name}
          </p>
          {level.subtitle ? <p className="text-xs text-navy/50">{level.subtitle}</p> : null}
          {level.teacher_name ? (
            <p className="text-xs text-navy/50">Teacher: {level.teacher_name}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setEditingLevel(true)}
          className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
          Edit
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {level.batches.map((batch) => (
          <BatchRowComponent
            key={batch.id}
            batch={batch}
            onEdit={() => setBatchModal({ mode: "edit", batch })}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setBatchModal({ mode: "add" })}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy/20 px-3.5 py-2 text-xs font-semibold text-navy/60 hover:border-red/30 hover:text-red"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Add Batch
      </button>

      {editingLevel ? (
        <LevelTextModal level={level} onClose={() => setEditingLevel(false)} />
      ) : null}

      {batchModal ? (
        <BatchFormModal
          key={batchModal.mode === "edit" ? batchModal.batch.id : "add"}
          mode={batchModal.mode}
          parent={{ levelId: level.id }}
          existing={batchModal.mode === "edit" ? batchModal.batch : undefined}
          nextDisplayOrder={nextDisplayOrder}
          contextLabel={`${phaseNumber} — ${level.name}`}
          onClose={() => setBatchModal(null)}
        />
      ) : null}
    </div>
  );
}
