"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AdminLesson } from "@/lib/content/getCourseDetail";
import {
  createLesson,
  updateLesson,
  type LessonFormInput,
} from "@/app/admin/(dashboard)/content/actions";
import { useToast } from "@/components/admin/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import ResourceListEditor from "./ResourceListEditor";
import VideoUploader from "./VideoUploader";

const VIDEO_PROVIDER_OPTIONS = [
  { value: "", label: "None yet" },
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "direct", label: "Direct file URL" },
  { value: "other", label: "Other / embed link" },
  { value: "upload", label: "Uploaded file" },
];

export default function LessonFormModal({
  courseId,
  weekId,
  existing,
  nextDisplayOrder,
  onClose,
}: {
  courseId: string;
  weekId: string;
  existing?: AdminLesson;
  nextDisplayOrder: number;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<LessonFormInput>({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    notes: existing?.notes ?? "",
    videoUrl: existing?.video_url ?? "",
    videoProvider: existing?.video_provider ?? "",
    displayOrder: existing?.display_order ?? nextDisplayOrder,
  });

  // Once a brand-new lesson is saved once (first "Add Lesson" click), it
  // has a real id and the video-upload/resources sections below can unlock
  // — without this, the admin would have to close the modal and reopen the
  // lesson in edit mode just to see the upload button, which read as "there
  // is no upload option."  This lets the SAME modal stay open and flip
  // straight into that unlocked state.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const lessonId = existing?.id ?? createdId;
  const isSaved = lessonId != null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      if (isSaved) {
        const result = await updateLesson(lessonId!, courseId, form);
        if (result.ok) {
          showToast("Changes saved successfully.");
          onClose();
        } else {
          showToast("Unable to save changes. Please try again.", "error");
        }
        return;
      }

      const result = await createLesson(weekId, courseId, form);
      if (result.ok) {
        setCreatedId(result.id);
        showToast("Lesson created — you can now upload a video or add resources below.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  // Uploads finish out-of-band (can take minutes for a 1hr video), so this
  // saves the lesson immediately rather than waiting on the next manual
  // "Save Changes" click — same as how resources save themselves on upload.
  const handleVideoUploaded = (storagePath: string) => {
    const previousPath = form.videoProvider === "upload" ? form.videoUrl : null;
    const updated: LessonFormInput = {
      ...form,
      videoUrl: storagePath,
      videoProvider: "upload",
    };
    setForm(updated);
    if (lessonId) {
      startTransition(async () => {
        const result = await updateLesson(lessonId, courseId, updated);
        if (!result.ok) {
          showToast("Video uploaded, but saving the lesson failed. Please try Save Changes.", "error");
          return;
        }
        // Best-effort cleanup — the lesson row (what access control and
        // playback actually depend on) already points at the new file, so a
        // failure here just leaves one orphaned object behind.
        if (previousPath && previousPath !== storagePath) {
          await createClient().storage.from("lesson-videos").remove([previousPath]);
        }
      });
    }
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
            {existing ? "Edit Lesson" : isSaved ? "Add Lesson — Saved" : "Add Lesson"}
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
              Lesson Title
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. French Pronunciation"
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

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Lesson Notes
            </label>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Shown to students below the video."
              className="mt-1.5 w-full resize-none rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Video URL (optional)
              </label>
              {form.videoProvider === "upload" ? (
                <>
                  <div className="mt-1.5 w-full rounded-xl border border-dashed border-navy/15 bg-cream-dim/60 px-3.5 py-2.5 text-sm text-navy/50">
                    Uploaded file — no URL needed
                  </div>
                  <p className="mt-1 text-[11px] text-navy/40">
                    Already saved. Upload a different file below to replace it, or clear this to go
                    back to pasting a link.
                  </p>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, videoUrl: "", videoProvider: "" }))}
                    className="mt-1 text-[11px] font-semibold text-navy/45 underline hover:text-red-dark"
                  >
                    Clear and paste a link instead
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={form.videoUrl}
                    onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                    placeholder="https://…"
                    className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
                  />
                  <p className="mt-1 text-[11px] text-navy/40">
                    Paste any video link — hosting is decided later.
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Video Provider
              </label>
              <select
                value={form.videoProvider}
                onChange={(e) => setForm((f) => ({ ...f, videoProvider: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              >
                {VIDEO_PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            {isSaved && lessonId ? (
              <>
                <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                  Or Upload a Video File
                </label>
                <div className="mt-1.5">
                  <VideoUploader
                    courseId={courseId}
                    lessonId={lessonId}
                    onUploaded={handleVideoUploaded}
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-navy/45">
                Click &ldquo;Add Lesson&rdquo; below first, then a video-upload option will appear
                right here.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Display Order
            </label>
            <input
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))}
              className="mt-1.5 w-full max-w-[140px] rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            />
          </div>

          {isSaved && lessonId ? (
            <div className="border-t border-navy/10 pt-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                Resources
              </label>
              <div className="mt-2">
                <ResourceListEditor
                  courseId={courseId}
                  lessonId={lessonId}
                  initialResources={existing?.resources ?? []}
                />
              </div>
            </div>
          ) : (
            <p className="border-t border-navy/10 pt-4 text-xs text-navy/45">
              Save the lesson first to add resources.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-navy/15 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream-dim"
            >
              {isSaved ? "Done" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-red px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
            >
              {pending ? "Saving…" : isSaved ? "Save Changes" : "Add Lesson"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
