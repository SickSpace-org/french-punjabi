"use client";

import { useState } from "react";
import type { BatchRow } from "@/types/database";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import SwapBatchModal from "./SwapBatchModal";

export type SwapPhaseOption = {
  phaseId: string;
  title: string;
  levels: { id: string; name: string }[];
};

export type SwapRow = {
  batch: BatchRow;
  phaseId: string;
  phaseTitle: string;
  /** Null for a batch sitting directly under the Phase (no Level layer). */
  levelName: string | null;
  studentCount: number;
  /** Pre-selected target level in the modal when the target phase is left as this row's own phase — the next level in order, or the phase's first level for a phase-direct batch. */
  defaultTargetLevelId: string | null;
};

export default function SwapBatchesClient({
  rows,
  allPhases,
}: {
  rows: SwapRow[];
  allPhases: SwapPhaseOption[];
}) {
  const [activeRow, setActiveRow] = useState<SwapRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-navy/15 bg-white p-8 text-center text-sm text-navy/50">
        No batches yet — add one on Courses first.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-xs font-semibold uppercase tracking-wide text-navy/50">
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.batch.id} className="border-b border-navy/5 last:border-b-0">
                <td className="px-4 py-3 text-navy/70">{row.phaseTitle}</td>
                <td className="px-4 py-3 text-navy/70">{row.levelName ?? "—"}</td>
                <td className="px-4 py-3 font-semibold text-navy">{formatBatchTiming(row.batch)}</td>
                <td className="px-4 py-3 text-navy/70">{row.studentCount}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setActiveRow(row)}
                    className="rounded-full bg-red px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark"
                  >
                    Swap →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeRow ? (
        <SwapBatchModal row={activeRow} allPhases={allPhases} onClose={() => setActiveRow(null)} />
      ) : null}
    </>
  );
}
