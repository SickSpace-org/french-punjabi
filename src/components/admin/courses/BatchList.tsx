"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BatchRow } from "@/types/database";
import BatchRowComponent from "./BatchRow";

/**
 * Active batches show directly; archived (deactivated) ones sit behind a
 * collapsed "N archived batches" toggle instead of cluttering the default
 * view with dimmed, struck-through rows — still one click away (with their
 * Restore button) for whenever an admin actually needs one back.
 */
export default function BatchList({
  batches,
  onEdit,
}: {
  batches: BatchRow[];
  onEdit: (batch: BatchRow) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const active = batches.filter((b) => b.is_active);
  const archived = batches.filter((b) => !b.is_active);

  return (
    <div className="space-y-2">
      {active.map((batch) => (
        <BatchRowComponent key={batch.id} batch={batch} onEdit={() => onEdit(batch)} />
      ))}

      {active.length === 0 && archived.length === 0 ? (
        <p className="text-xs text-navy/40">No batches yet.</p>
      ) : null}

      {archived.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-navy/40 hover:text-navy/60"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${showArchived ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
            {showArchived ? "Hide" : "Show"} {archived.length} archived batch{archived.length === 1 ? "" : "es"}
          </button>

          {showArchived ? (
            <div className="mt-2 space-y-2">
              {archived.map((batch) => (
                <BatchRowComponent key={batch.id} batch={batch} onEdit={() => onEdit(batch)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
