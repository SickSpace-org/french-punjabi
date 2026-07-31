"use client";

import { TriangleAlert } from "lucide-react";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-navy/10 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              danger ? "bg-red-soft text-red" : "bg-cream-dim text-navy/60"
            }`}
          >
            <TriangleAlert className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <p className="font-display text-base font-bold text-navy">{title}</p>
            <p className="mt-1 text-sm text-navy/60">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-navy/15 bg-white px-5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-full px-5 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors disabled:opacity-60 ${
              danger ? "bg-red hover:bg-red-dark" : "bg-navy hover:bg-navy-dark"
            }`}
          >
            {pending ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
