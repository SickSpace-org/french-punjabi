"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import type { AdminCourseSummary, AdminPhaseOption } from "@/lib/content/getAdminContentData";
import { setCourseActive, setCourseStatus } from "@/app/admin/(dashboard)/content/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import CourseFormModal from "./CourseFormModal";

export default function ContentCoursesClient({
  initialCourses,
  phaseOptions,
}: {
  initialCourses: AdminCourseSummary[];
  phaseOptions: AdminPhaseOption[];
}) {
  const courses = initialCourses;
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [courseModal, setCourseModal] = useState<
    { mode: "add" } | { mode: "edit"; course: AdminCourseSummary } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminCourseSummary | null>(null);

  const nextDisplayOrder = courses.reduce((max, c) => Math.max(max, c.display_order), 0) + 1;

  const togglePublish = (course: AdminCourseSummary) => {
    startTransition(async () => {
      const result = await setCourseStatus(
        course.id,
        course.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"
      );
      showToast(
        result.ok ? "Changes saved successfully." : "Unable to save changes. Please try again.",
        result.ok ? "success" : "error"
      );
    });
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    const course = confirmDelete;
    startTransition(async () => {
      const result = await setCourseActive(course.id, false);
      setConfirmDelete(null);
      showToast(
        result.ok ? "Course deleted." : "Unable to save changes. Please try again.",
        result.ok ? "success" : "error"
      );
    });
  };

  const handleRestore = (course: AdminCourseSummary) => {
    startTransition(async () => {
      const result = await setCourseActive(course.id, true);
      showToast(
        result.ok ? "Course restored." : "Unable to save changes. Please try again.",
        result.ok ? "success" : "error"
      );
    });
  };

  if (phaseOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-10 text-center text-sm text-navy/60">
        Create at least one Phase under Admin → Courses before adding course content.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {courses.map((course) => (
        <div
          key={course.id}
          className={`rounded-2xl border bg-white p-5 sm:p-6 ${
            course.is_active ? "border-navy/10" : "border-dashed border-navy/15 opacity-70"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-red">
                {course.phaseTitle}
                {course.levelName ? ` — ${course.levelName}` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-navy">{course.title}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                    course.status === "PUBLISHED"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-navy/10 text-navy/50"
                  }`}
                >
                  {course.status}
                </span>
                {!course.is_active ? (
                  <span className="rounded-full bg-red-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-dark">
                    Deleted
                  </span>
                ) : null}
              </div>
              {course.description ? (
                <p className="mt-1.5 max-w-xl text-sm text-navy/60">{course.description}</p>
              ) : null}
              <p className="mt-1.5 text-xs text-navy/50">
                {course.weekCount} {course.weekCount === 1 ? "Week" : "Weeks"} · {course.lessonCount}{" "}
                {course.lessonCount === 1 ? "Lesson" : "Lessons"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {course.is_active ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => togglePublish(course)}
                    className="rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
                  >
                    {course.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseModal({ mode: "edit", course })}
                    className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={2} />
                    Edit
                  </button>
                  <Link
                    href={`/admin/content/${course.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-red px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark"
                  >
                    <BookOpen className="h-3.5 w-3.5" strokeWidth={2} />
                    Manage Content
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(course)}
                    aria-label="Delete course"
                    className="rounded-full border border-navy/15 bg-white p-1.5 text-navy/50 hover:border-red/30 hover:text-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRestore(course)}
                  className="rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setCourseModal({ mode: "add" })}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy/20 px-4 py-2.5 text-sm font-semibold text-navy/60 hover:border-red/30 hover:text-red"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Create Course
      </button>

      {courseModal ? (
        <CourseFormModal
          key={courseModal.mode === "edit" ? courseModal.course.id : "add"}
          mode={courseModal.mode}
          existing={courseModal.mode === "edit" ? courseModal.course : undefined}
          phaseOptions={phaseOptions}
          nextDisplayOrder={nextDisplayOrder}
          onClose={() => setCourseModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete != null}
        title="Delete this course?"
        description="Students lose access to this course's content immediately. Progress, comments and access records are kept — you can restore it later from here."
        confirmLabel="Delete Course"
        danger
        pending={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
