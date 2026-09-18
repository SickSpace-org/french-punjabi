"use client";

import { useRef, useState } from "react";
import { FileText, Pencil, Trash2, Upload } from "lucide-react";
import type { LessonResourceRow } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import {
  createResource,
  removeResource,
  renameResource,
} from "@/app/admin/(dashboard)/content/actions";
import { useToast } from "@/components/admin/ToastProvider";

/** Path convention {courseId}/{lessonId}/{filename} — storage RLS keys off
 * the first path segment (see supabase/009_lesson_resources_storage.sql). */
function buildStoragePath(courseId: string, lessonId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${courseId}/${lessonId}/${Date.now()}-${safeName}`;
}

export default function ResourceListEditor({
  courseId,
  lessonId,
  initialResources,
}: {
  courseId: string;
  lessonId: string;
  initialResources: LessonResourceRow[];
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resources, setResources] = useState(initialResources);
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const storagePath = buildStoragePath(courseId, lessonId, file.name);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("lesson-resources")
        .upload(storagePath, file);

      if (uploadError) {
        showToast("Unable to upload file. Please try again.", "error");
        return;
      }

      const result = await createResource(lessonId, courseId, {
        title: file.name,
        storagePath,
        displayOrder: resources.length,
      });

      if (result.ok) {
        setResources((prev) => [
          ...prev,
          {
            id: result.id,
            lesson_id: lessonId,
            title: file.name,
            storage_path: storagePath,
            display_order: prev.length,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
        showToast("Resource added.");
      } else {
        showToast("Unable to save resource. Please try again.", "error");
      }
    } finally {
      setUploading(false);
    }
  };

  const startRename = (resource: LessonResourceRow) => {
    setRenamingId(resource.id);
    setRenameValue(resource.title);
  };

  const saveRename = async (resourceId: string) => {
    setBusyId(resourceId);
    const result = await renameResource(resourceId, courseId, renameValue.trim() || "Untitled");
    setBusyId(null);
    setRenamingId(null);
    if (result.ok) {
      setResources((prev) =>
        prev.map((r) => (r.id === resourceId ? { ...r, title: renameValue.trim() || "Untitled" } : r))
      );
      showToast("Resource renamed.");
    } else {
      showToast("Unable to save changes. Please try again.", "error");
    }
  };

  const handleRemove = async (resource: LessonResourceRow) => {
    setBusyId(resource.id);
    const result = await removeResource(resource.id, courseId, resource.storage_path);
    setBusyId(null);
    if (result.ok) {
      setResources((prev) => prev.filter((r) => r.id !== resource.id));
      showToast("Resource removed.");
    } else {
      showToast("Unable to save changes. Please try again.", "error");
    }
  };

  return (
    <div>
      <div className="space-y-2">
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-navy/10 bg-cream-dim/50 px-3.5 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-navy/40" strokeWidth={2} />
              {renamingId === resource.id ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => saveRename(resource.id)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename(resource.id)}
                  className="w-full rounded-lg border border-navy/15 bg-white px-2 py-1 text-sm text-navy outline-none focus:border-red"
                />
              ) : (
                <span className="truncate text-sm font-medium text-navy">{resource.title}</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => startRename(resource)}
                disabled={busyId === resource.id}
                aria-label="Rename resource"
                className="rounded-full p-1.5 text-navy/50 hover:bg-white hover:text-navy disabled:opacity-60"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(resource)}
                disabled={busyId === resource.id}
                aria-label="Remove resource"
                className="rounded-full p-1.5 text-navy/50 hover:bg-white hover:text-red disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy/20 px-3.5 py-2 text-xs font-semibold text-navy/60 hover:border-red/30 hover:text-red disabled:opacity-60"
      >
        <Upload className="h-3.5 w-3.5" strokeWidth={2} />
        {uploading ? "Uploading…" : "Add Resource"}
      </button>
    </div>
  );
}
