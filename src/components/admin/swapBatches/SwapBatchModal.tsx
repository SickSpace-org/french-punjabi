"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AvailabilityStatus } from "@/types/database";
import { swapBatch, type SwapBatchInput, type SwapTarget } from "@/app/admin/(dashboard)/swap-batches/actions";
import { useToast } from "@/components/admin/ToastProvider";
import type { SwapPhaseOption, SwapRow } from "./SwapBatchesClient";

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "almost_full", label: "Almost Full" },
  { value: "full", label: "Full" },
  { value: "hidden", label: "Hidden" },
];

/** HTML <select> values must be strings — stand in for the non-existing-level targets. */
const NO_LEVEL_VALUE = "__none__";
const NEW_LEVEL_VALUE = "__new__";

export default function SwapBatchModal({
  row,
  allPhases,
  onClose,
}: {
  row: SwapRow;
  allPhases: SwapPhaseOption[];
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [targetPhaseId, setTargetPhaseId] = useState(row.phaseId);
  const [targetValue, setTargetValue] = useState(row.defaultTargetLevelId || NO_LEVEL_VALUE);
  const [newLevelName, setNewLevelName] = useState("");

  const targetPhase = allPhases.find((p) => p.phaseId === targetPhaseId) ?? allPhases[0];
  const levelOptions = targetPhase?.levels ?? [];

  const handlePhaseChange = (nextPhaseId: string) => {
    setTargetPhaseId(nextPhaseId);
    if (nextPhaseId === row.phaseId) {
      // Back to this batch's own phase — restore the smart same-phase
      // default (next level in order) instead of always falling back to
      // the first level.
      setTargetValue(row.defaultTargetLevelId || NO_LEVEL_VALUE);
    } else {
      const nextPhase = allPhases.find((p) => p.phaseId === nextPhaseId);
      setTargetValue(nextPhase?.levels[0]?.id || NO_LEVEL_VALUE);
    }
  };
  const [form, setForm] = useState<SwapBatchInput>({
    name: row.batch.name ?? "",
    teacherName: row.batch.teacher_name ?? "",
    timeLabel: row.batch.time_label,
    timezone: row.batch.timezone,
    note: row.batch.note ?? "",
    isTbd: row.batch.is_tbd,
    availabilityStatus: row.batch.availability_status,
    totalSlots: row.batch.total_slots,
  });

  const isNewLevel = targetValue === NEW_LEVEL_VALUE;
  const trimmedNewLevelName = newLevelName.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNewLevel && !trimmedNewLevelName) return;

    const target: SwapTarget =
      targetValue === NO_LEVEL_VALUE
        ? { type: "none", phaseId: targetPhaseId }
        : isNewLevel
          ? { type: "new", name: trimmedNewLevelName, phaseId: targetPhaseId }
          : { type: "existing", levelId: targetValue };

    startTransition(async () => {
      const result = await swapBatch(row.batch.id, target, form);
      if (result.ok) {
        showToast(
          `Moved ${result.movedCount} student${result.movedCount === 1 ? "" : "s"} to the new batch.`
        );
        onClose();
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-navy/10 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-lg font-bold text-navy">Swap Batch</p>
            <p className="mt-0.5 text-xs text-navy/50">
              {row.phaseTitle}
              {row.levelName ? ` — ${row.levelName}` : ""} — moving {row.studentCount} student
              {row.studentCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-navy/50 hover:bg-cream-dim hover:text-navy"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Target Phase
            </label>
            <select
              required
              value={targetPhaseId}
              onChange={(e) => handlePhaseChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            >
              {allPhases.map((p) => (
                <option key={p.phaseId} value={p.phaseId}>
                  {p.title}
                  {p.phaseId === row.phaseId ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Target Level
            </label>
            <select
              required
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            >
              {levelOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
              <option value={NO_LEVEL_VALUE}>No Level (stay directly under this Phase)</option>
              <option value={NEW_LEVEL_VALUE}>+ Create New Level</option>
            </select>
          </div>

          {isNewLevel ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                New Level Name
              </label>
              <input
                type="text"
                required
                value={newLevelName}
                onChange={(e) => setNewLevelName(e.target.value)}
                placeholder="e.g. Level 4"
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
              <p className="mt-1 text-[11px] text-navy/40">
                Creates this as a new Level under {targetPhase?.title ?? row.phaseTitle} first, then
                swaps into it.
              </p>
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Batch Name (optional)
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. October Batch"
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Time
              </label>
              <input
                type="text"
                required
                value={form.timeLabel}
                onChange={(e) => setForm((f) => ({ ...f, timeLabel: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Timezone
              </label>
              <input
                type="text"
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-navy/70">
            <input
              type="checkbox"
              checked={form.isTbd}
              onChange={(e) => setForm((f) => ({ ...f, isTbd: e.target.checked }))}
              className="h-4 w-4 rounded border-navy/25 text-red focus:ring-red/30"
            />
            Time to be confirmed
          </label>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Teacher (optional)
            </label>
            <input
              type="text"
              value={form.teacherName}
              onChange={(e) => setForm((f) => ({ ...f, teacherName: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Note (optional)
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Total Slots (optional)
              </label>
              <input
                type="number"
                min={0}
                value={form.totalSlots ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    totalSlots: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Availability
              </label>
              <select
                value={form.availabilityStatus}
                onChange={(e) =>
                  setForm((f) => ({ ...f, availabilityStatus: e.target.value as AvailabilityStatus }))
                }
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-navy/40">
            Creates a new batch under the target Phase/Level with these details, moves every
            currently enrolled student across — even into a different Phase — and archives the
            old batch (its attendance history stays intact).
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-navy/15 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream-dim"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !targetValue || (isNewLevel && !trimmedNewLevelName)}
              className="rounded-full bg-red px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
            >
              {pending ? "Swapping…" : "Swap Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
