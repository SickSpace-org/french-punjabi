"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AssignableCourse } from "@/lib/students/getStudentDetail";
import { assignCourseAccess } from "@/app/admin/(dashboard)/students/[studentId]/actions";
import { useToast } from "@/components/admin/ToastProvider";

export default function AssignCourseModal({
  studentId,
  courses,
  onClose,
  onAssigned,
}: {
  studentId: string;
  courses: AssignableCourse[];
  onClose: () => void;
  onAssigned: (course: AssignableCourse) => void;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(courses[0]?.id ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    startTransition(async () => {
      const result = await assignCourseAccess(studentId, selectedId);
      if (result.ok) {
        const course = courses.find((c) => c.id === selectedId);
        if (course) onAssigned(course);
        showToast("Course access granted.");
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
        className="w-full max-w-md rounded-2xl border border-navy/10 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <p className="font-display text-lg font-bold text-navy">Assign Course</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-navy/50 hover:bg-cream-dim hover:text-navy"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {courses.length === 0 ? (
          <p className="mt-5 text-sm text-navy/60">
            No courses exist yet — create one under Admin → Content first.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Course
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.phaseTitle}
                    {c.levelName ? ` — ${c.levelName}` : ""} · {c.title}
                  </option>
                ))}
              </select>
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
                {pending ? "Saving…" : "Assign Course"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
