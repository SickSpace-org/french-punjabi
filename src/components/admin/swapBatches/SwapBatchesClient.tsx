"use client";

import { useState } from "react";
import type { BatchRow } from "@/types/database";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import SwapBatchModal from "./SwapBatchModal";

export type SwapRow = {
  batch: BatchRow;
  phaseTitle: string;
  /** Null for a batch sitting directly under the Phase (no Level layer). */
  levelName: string | null;
  studentCount: number;
  /** Levels in the same phase this batch could swap into. Empty means nothing to swap into. */
  levelOptions: { id: string; name: string }[];
  /** Pre-selected target level in the modal — the next level in order, or the phase's first level for a phase-direct batch. */
  defaultTargetLevelId: string | null;
};

export default function SwapBatchesClient({ rows }: { rows: SwapRow[] }) {
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
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-xs font-semibold uppercase tracking-wide text-navy/50">
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const disabledReason = !row.batch.is_active
                ? "This batch is already archived"
                : row.levelOptions.length === 0
                  ? "No level in this phase to swap into"
                  : undefined;

              return (
                <tr
                  key={row.batch.id}
                  className={`border-b border-navy/5 last:border-b-0 ${!row.batch.is_active ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3 text-navy/70">{row.phaseTitle}</td>
                  <td className="px-4 py-3 text-navy/70">{row.levelName ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-navy">{formatBatchTiming(row.batch)}</td>
                  <td className="px-4 py-3 text-navy/70">{row.studentCount}</td>
                  <td className="px-4 py-3">
                    {row.batch.is_active ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-navy/15 bg-navy/5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy/50">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={disabledReason !== undefined}
                      onClick={() => setActiveRow(row)}
                      title={disabledReason}
                      className="rounded-full bg-red px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:cursor-not-allowed disabled:bg-navy/15 disabled:text-navy/40 disabled:shadow-none"
                    >
                      Swap →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeRow ? <SwapBatchModal row={activeRow} onClose={() => setActiveRow(null)} /> : null}
    </>
  );
}
