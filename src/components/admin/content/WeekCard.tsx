"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Video } from "lucide-react";
import type { AdminLesson, AdminWeek } from "@/lib/content/getCourseDetail";
import {
  setLessonActive,
  setLessonStatus,
  setWeekActive,
  setWeekStatus,
} from "@/app/admin/(dashboard)/content/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import WeekFormModal from "./WeekFormModal";
import LessonFormModal from "./LessonFormModal";

export default function WeekCard({ week, courseId }: { week: AdminWeek; courseId: string }) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editingWeek, setEditingWeek] = useState(false);
  const [confirmDeleteWeek, setConfirmDeleteWeek] = useState(false);
  const [lessonModal, setLessonModal] = useState<
    { mode: "add" } | { mode: "edit"; lesson: AdminLesson } | null
  >(null);
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<AdminLesson | null>(null);

  const nextLessonDisplayOrder =
    week.lessons.reduce((max, l) => Math.max(max, l.display_order), 0) + 1;

  const runToast = (result: { ok: boolean }) => {
    showToast(
      result.ok ? "Changes saved successfully." : "Unable to save changes. Please try again.",
      result.ok ? "success" : "error"
    );
  };

  const toggleWeekPublish = () => {
    startTransition(async () => {
      runToast(
        await setWeekStatus(week.id, courseId, week.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")
      );
    });
  };

  const handleDeleteWeek = () => {
    startTransition(async () => {
      const result = await setWeekActive(week.id, courseId, false);
      setConfirmDeleteWeek(false);
      runToast(result);
    });
  };

  const handleRestoreWeek = () => {
    startTransition(async () => {
      runToast(await setWeekActive(week.id, courseId, true));
    });
  };

  const toggleLessonPublish = (lesson: AdminLesson) => {
    startTransition(async () => {
      runToast(
        await setLessonStatus(
          lesson.id,
          courseId,
          lesson.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"
        )
      );
    });
  };

  const handleDeleteLesson = () => {
    if (!confirmDeleteLesson) return;
    const lesson = confirmDeleteLesson;
    startTransition(async () => {
      const result = await setLessonActive(lesson.id, courseId, false);
      setConfirmDeleteLesson(null);
      runToast(result);
    });
  };

  const handleRestoreLesson = (lesson: AdminLesson) => {
    startTransition(async () => {
      runToast(await setLessonActive(lesson.id, courseId, true));
    });
  };

  return (
    <div className={`rounded-2xl border bg-white ${week.is_active ? "border-navy/10" : "border-dashed border-navy/15 opacity-70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-navy/40" strokeWidth={2} />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-navy/40" strokeWidth={2} />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-red">
              Week {week.week_number}
            </p>
            <p className="truncate font-display text-base font-bold text-navy">{week.title}</p>
            <p className="text-xs text-navy/50">
              {week.lessons.length} {week.lessons.length === 1 ? "Lesson" : "Lessons"}
            </p>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              week.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-navy/10 text-navy/50"
            }`}
          >
            {week.status}
          </span>
          {week.is_active ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={toggleWeekPublish}
                className="rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
              >
                {week.status === "PUBLISHED" ? "Unpublish" : "Publish"}
              </button>
              <button
                type="button"
                onClick={() => setEditingWeek(true)}
                className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim"
              >
                <Pencil className="h-3 w-3" strokeWidth={2} />
                Manage
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteWeek(true)}
                aria-label="Delete week"
                className="rounded-full border border-navy/15 bg-white p-1.5 text-navy/50 hover:border-red/30 hover:text-red"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={handleRestoreWeek}
              className="rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
            >
              Restore
            </button>
          )}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-2 border-t border-navy/8 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          {week.lessons.map((lesson) => (
            <div
              key={lesson.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${
                lesson.is_active ? "border-navy/10 bg-cream-dim/40" : "border-dashed border-navy/15 opacity-70"
              }`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                  {lesson.video_url ? <Video className="h-3.5 w-3.5 shrink-0 text-navy/40" strokeWidth={2} /> : null}
                  {lesson.title}
                </p>
                <p className="text-xs text-navy/50">
                  {lesson.resources.length} {lesson.resources.length === 1 ? "Resource" : "Resources"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    lesson.status === "PUBLISHED"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-navy/10 text-navy/50"
                  }`}
                >
                  {lesson.status}
                </span>
                {lesson.is_active ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleLessonPublish(lesson)}
                      className="rounded-full border border-navy/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
                    >
                      {lesson.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLessonModal({ mode: "edit", lesson })}
                      className="rounded-full border border-navy/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy hover:bg-cream-dim"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteLesson(lesson)}
                      aria-label="Delete lesson"
                      className="rounded-full border border-navy/15 bg-white p-1 text-navy/50 hover:border-red/30 hover:text-red"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleRestoreLesson(lesson)}
                    className="rounded-full border border-navy/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setLessonModal({ mode: "add" })}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy/20 px-3.5 py-2 text-xs font-semibold text-navy/60 hover:border-red/30 hover:text-red"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add Lesson
          </button>
        </div>
      ) : null}

      {editingWeek ? (
        <WeekFormModal
          mode="edit"
          courseId={courseId}
          existing={week}
          nextWeekNumber={week.week_number}
          nextDisplayOrder={week.display_order}
          onClose={() => setEditingWeek(false)}
        />
      ) : null}

      {lessonModal ? (
        <LessonFormModal
          key={lessonModal.mode === "edit" ? lessonModal.lesson.id : "add"}
          mode={lessonModal.mode}
          courseId={courseId}
          weekId={week.id}
          existing={lessonModal.mode === "edit" ? lessonModal.lesson : undefined}
          nextDisplayOrder={nextLessonDisplayOrder}
          onClose={() => setLessonModal(null)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmDeleteWeek}
        title="Delete this week?"
        description="Its lessons become inaccessible to students too. Everything is kept and can be restored later."
        confirmLabel="Delete Week"
        danger
        pending={pending}
        onCancel={() => setConfirmDeleteWeek(false)}
        onConfirm={handleDeleteWeek}
      />

      <ConfirmDialog
        open={confirmDeleteLesson != null}
        title="Delete this lesson?"
        description="Students lose access to this lesson immediately. It can be restored later from here."
        confirmLabel="Delete Lesson"
        danger
        pending={pending}
        onCancel={() => setConfirmDeleteLesson(null)}
        onConfirm={handleDeleteLesson}
      />
    </div>
  );
}
