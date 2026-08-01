"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AvailabilityStatus, BatchRow } from "@/types/database";
import {
  createBatch,
  updateBatch,
  type BatchFormInput,
} from "@/app/admin/(dashboard)/courses/actions";
import { useToast } from "@/components/admin/ToastProvider";

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "almost_full", label: "Almost Full" },
  { value: "full", label: "Full" },
  { value: "hidden", label: "Hidden" },
];

export type BatchFormModalProps = {
  mode: "add" | "edit";
  onClose: () => void;
  parent: { phaseId: string } | { levelId: string };
  existing?: BatchRow;
  nextDisplayOrder: number;
  contextLabel: string;
};

export default function BatchFormModal({
  mode,
  onClose,
  parent,
  existing,
  nextDisplayOrder,
  contextLabel,
}: BatchFormModalProps) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<BatchFormInput>({
    name: existing?.name ?? "",
    teacherName: existing?.teacher_name ?? "",
    timeLabel: existing?.time_label ?? "",
    timezone: existing?.timezone ?? "EST",
    note: existing?.note ?? "",
    isTbd: existing?.is_tbd ?? false,
    availabilityStatus: existing?.availability_status ?? "available",
    totalSlots: existing?.total_slots ?? null,
    filledSlots: existing?.filled_slots ?? 0,
    displayOrder: existing?.display_order ?? nextDisplayOrder,
  });

  const seatsLeft = form.totalSlots != null ? Math.max(form.totalSlots - form.filledSlots, 0) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result =
        mode === "add" ? await createBatch(parent, form) : await updateBatch(existing!.id, form);

      if (result.ok) {
        showToast("Changes saved successfully.");
        onClose();
      } else {
        showToast("Unable to save changes. Please try again.", "error");
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
            <p className="font-display text-lg font-bold text-navy">
              {mode === "add" ? "Add Batch" : "Edit Batch"}
            </p>
            <p className="mt-0.5 text-xs text-navy/50">{contextLabel}</p>
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
              Batch Name (optional)
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Hitesh Batch"
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
                placeholder="8:00 PM"
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
                placeholder="EST"
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
              Note (optional)
            </label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. Morning Batch"
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

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
                placeholder="e.g. 20"
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Slots Filled
              </label>
              <input
                type="number"
                min={0}
                value={form.filledSlots}
                onChange={(e) =>
                  setForm((f) => ({ ...f, filledSlots: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>
          </div>

          {seatsLeft !== null ? (
            <p className="text-xs font-semibold text-navy/60">
              {seatsLeft} of {form.totalSlots} seats left — shown to students as &ldquo;{seatsLeft} left&rdquo;
            </p>
          ) : (
            <p className="text-xs text-navy/40">
              Leave Total Slots blank to keep using the manual Availability status below only.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Availability
              </label>
              <select
                value={form.availabilityStatus}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    availabilityStatus: e.target.value as AvailabilityStatus,
                  }))
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
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Display Order
              </label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>
          </div>

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
              disabled={pending}
              className="rounded-full bg-red px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
            >
              {pending ? "Saving…" : mode === "add" ? "Save Batch" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
