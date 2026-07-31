"use client";

import { useState, useTransition } from "react";
import { Minus, Pencil, Plus, Trash2, User } from "lucide-react";
import type { AvailabilityStatus, BatchRow as BatchRowType } from "@/types/database";
import {
  setBatchActive,
  updateBatchSlots,
  updateBatchStatus,
} from "@/app/admin/(dashboard)/courses/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "almost_full", label: "Almost Full" },
  { value: "full", label: "Full" },
  { value: "hidden", label: "Hidden" },
];

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  available: "bg-green-50 text-green-700 border-green-200",
  almost_full: "bg-amber-50 text-amber-700 border-amber-200",
  full: "bg-navy/5 text-navy/50 border-navy/10",
  hidden: "bg-red-soft text-red-dark border-red/20",
};

function timeDisplay(batch: BatchRowType) {
  const base = batch.timezone ? `${batch.time_label} ${batch.timezone}`.trim() : batch.time_label;
  return batch.is_tbd ? `${base} — To Be Confirmed` : base;
}

export default function BatchRow({
  batch,
  onEdit,
}: {
  batch: BatchRowType;
  onEdit: () => void;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmHide, setConfirmHide] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const applyStatus = (status: AvailabilityStatus) => {
    startTransition(async () => {
      const result = await updateBatchStatus(batch.id, status);
      if (result.ok) {
        showToast("Changes saved successfully.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  const adjustFilledSlots = (delta: number) => {
    if (batch.total_slots == null) return;
    const next = Math.min(Math.max(batch.filled_slots + delta, 0), batch.total_slots);
    if (next === batch.filled_slots) return;
    startTransition(async () => {
      const result = await updateBatchSlots(batch.id, {
        totalSlots: batch.total_slots,
        filledSlots: next,
      });
      if (!result.ok) {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  const handleStatusChange = (value: AvailabilityStatus) => {
    if (value === "hidden" && batch.availability_status !== "hidden") {
      setConfirmHide(true);
      return;
    }
    applyStatus(value);
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await setBatchActive(batch.id, false);
      setConfirmDelete(false);
      if (result.ok) {
        showToast("Changes saved successfully.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const result = await setBatchActive(batch.id, true);
      if (result.ok) {
        showToast("Batch restored.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  if (!batch.is_active) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-navy/15 bg-cream-dim/60 px-4 py-3 opacity-70">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-navy/50 line-through">
            {batch.name ? `${batch.name} — ` : ""}
            {timeDisplay(batch)}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/35">
            Deleted
          </p>
        </div>
        <button
          type="button"
          onClick={handleRestore}
          disabled={pending}
          className="rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
        >
          Restore
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy/10 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">
            {batch.name ? <span className="text-navy/80">{batch.name} — </span> : null}
            {timeDisplay(batch)}
          </p>
          {batch.teacher_name ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-navy/50">
              <User className="h-3 w-3" strokeWidth={2} />
              {batch.teacher_name}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {batch.total_slots != null ? (
            <div className="flex items-center gap-1.5 rounded-full border border-navy/15 bg-cream-dim/60 px-2 py-1">
              <button
                type="button"
                onClick={() => adjustFilledSlots(-1)}
                disabled={pending || batch.filled_slots <= 0}
                aria-label="One fewer slot filled"
                className="rounded-full p-0.5 text-navy/50 hover:bg-white hover:text-navy disabled:opacity-40"
              >
                <Minus className="h-3 w-3" strokeWidth={2.5} />
              </button>
              <span className="min-w-[4.5rem] text-center text-xs font-bold text-navy">
                {Math.max(batch.total_slots - batch.filled_slots, 0)} left
              </span>
              <button
                type="button"
                onClick={() => adjustFilledSlots(1)}
                disabled={pending || batch.filled_slots >= batch.total_slots}
                aria-label="One more slot filled"
                className="rounded-full p-0.5 text-navy/50 hover:bg-white hover:text-navy disabled:opacity-40"
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>
          ) : null}

          <select
            value={batch.availability_status}
            disabled={pending}
            onChange={(e) => handleStatusChange(e.target.value as AvailabilityStatus)}
            className={`rounded-full border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide outline-none disabled:opacity-60 ${STATUS_STYLES[batch.availability_status]}`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim"
          >
            <Pencil className="h-3 w-3" strokeWidth={2} />
            Edit
          </button>

          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete batch"
            className="rounded-full border border-navy/15 bg-white p-1.5 text-navy/50 hover:border-red/30 hover:text-red"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmHide}
        title="Hide this batch?"
        description="Students will no longer see this batch on the Courses page."
        confirmLabel="Hide Batch"
        danger
        pending={pending}
        onCancel={() => setConfirmHide(false)}
        onConfirm={() => {
          applyStatus("hidden");
          setConfirmHide(false);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this batch?"
        description="This removes it from the Courses page. Past enrollment records referencing it are preserved — you can restore it later from here."
        confirmLabel="Delete Batch"
        danger
        pending={pending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
