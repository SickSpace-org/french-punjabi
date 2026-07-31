"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AdminWeek } from "@/lib/content/getCourseDetail";
import { createWeek, updateWeek, type WeekFormInput } from "@/app/admin/(dashboard)/content/actions";
import { useToast } from "@/components/admin/ToastProvider";

export default function WeekFormModal({
  mode,
  courseId,
  existing,
  nextWeekNumber,
  nextDisplayOrder,
  onClose,
}: {
  mode: "add" | "edit";
  courseId: string;
  existing?: AdminWeek;
  nextWeekNumber: number;
  nextDisplayOrder: number;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<WeekFormInput>({
    weekNumber: existing?.week_number ?? nextWeekNumber,
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    displayOrder: existing?.display_order ?? nextDisplayOrder,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result =
        mode === "add"
          ? await createWeek(courseId, form)
          : await updateWeek(existing!.id, courseId, form);

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
          <p className="font-display text-lg font-bold text-navy">
            {mode === "add" ? "Add Week" : "Edit Week"}
          </p>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Week Number
              </label>
              <input
                type="number"
                required
                value={form.weekNumber}
                onChange={(e) => setForm((f) => ({ ...f, weekNumber: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Display Order
              </label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Week Title
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Grammar Foundations"
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1.5 w-full resize-none rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
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
              {pending ? "Saving…" : mode === "add" ? "Add Week" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
