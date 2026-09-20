"use client";

import { useState } from "react";
import type { BatchRow } from "@/types/database";
import { formatBatchTiming } from "@/lib/courses/batchLabel";
import SwapBatchModal from "./SwapBatchModal";

export type SwapRow = {
  batch: BatchRow;
  phaseTitle: string;
  levelName: string;
  studentCount: number;
  /** Other levels in the same phase this batch could swap into. Empty means nothing to swap into. */
  levelOptions: { id: string; name: string }[];
  /** The level right after this one in display order, if any — pre-selected in the modal. */
  defaultTargetLevelId: string | null;
};

export default function SwapBatchesClient({ rows }: { rows: SwapRow[] }) {
  const [activeRow, setActiveRow] = useState<SwapRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-navy/15 bg-white p-8 text-center text-sm text-navy/50">
        No swappable batches yet — a batch only shows up here once it sits inside a Level that has another Level in the same Phase to swap into.
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
                <td className="px-4 py-3 text-navy/70">{row.levelName}</td>
                <td className="px-4 py-3 font-semibold text-navy">{formatBatchTiming(row.batch)}</td>
                <td className="px-4 py-3 text-navy/70">{row.studentCount}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={row.levelOptions.length === 0}
                    onClick={() => setActiveRow(row)}
                    title={
                      row.levelOptions.length === 0
                        ? "No other level in this phase to swap into"
                        : undefined
                    }
                    className="rounded-full bg-red px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:cursor-not-allowed disabled:bg-navy/15 disabled:text-navy/40 disabled:shadow-none"
                  >
                    Swap →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeRow ? <SwapBatchModal row={activeRow} onClose={() => setActiveRow(null)} /> : null}
    </>
  );
}
