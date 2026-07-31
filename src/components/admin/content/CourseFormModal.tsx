"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AdminCourseSummary, AdminPhaseOption } from "@/lib/content/getAdminContentData";
import {
  createCourse,
  updateCourse,
  type CourseFormInput,
} from "@/app/admin/(dashboard)/content/actions";
import { useToast } from "@/components/admin/ToastProvider";

export default function CourseFormModal({
  mode,
  existing,
  phaseOptions,
  nextDisplayOrder,
  onClose,
}: {
  mode: "add" | "edit";
  existing?: AdminCourseSummary;
  phaseOptions: AdminPhaseOption[];
  nextDisplayOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<CourseFormInput>({
    phaseId: existing?.phase_id ?? phaseOptions[0]?.id ?? "",
    levelId: existing?.level_id ?? null,
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    thumbnailUrl: existing?.thumbnail_url ?? "",
    displayOrder: existing?.display_order ?? nextDisplayOrder,
  });

  const selectedPhase = phaseOptions.find((p) => p.id === form.phaseId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result =
        mode === "add" ? await createCourse(form) : await updateCourse(existing!.id, form);

      if (result.ok) {
        showToast("Changes saved successfully.");
        onClose();
        if (mode === "add" && "id" in result) router.push(`/admin/content/${result.id}`);
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-navy/10 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <p className="font-display text-lg font-bold text-navy">
            {mode === "add" ? "Create Course" : "Edit Course"}
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Course Name
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. French Foundations"
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Phase
              </label>
              <select
                value={form.phaseId}
                onChange={(e) => setForm((f) => ({ ...f, phaseId: e.target.value, levelId: null }))}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              >
                {phaseOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    Phase {p.phaseNumber} — {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Level (optional)
              </label>
              <select
                value={form.levelId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, levelId: e.target.value || null }))}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              >
                <option value="">None</option>
                {selectedPhase?.levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Description
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1.5 w-full resize-none rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Thumbnail URL (optional)
            </label>
            <input
              type="text"
              value={form.thumbnailUrl}
              onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
              placeholder="https://…"
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
              {pending ? "Saving…" : mode === "add" ? "Create Course" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
