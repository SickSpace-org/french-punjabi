"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Eye, EyeOff, ExternalLink, FileText, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import type { AdminResource } from "@/lib/resources/queries";
import {
  createResource,
  deleteResource,
  previewYouTubeUrl,
  setResourcePublished,
  updateResource,
  type NewResourceType,
  type ResourceFormInput,
  type YouTubePreviewResult,
} from "@/app/admin/(dashboard)/resources/actions";
import { CATEGORY_SUGGESTIONS, formatBytes } from "@/lib/resources/config";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/ToastProvider";
import PdfViewerLoader from "@/components/resources/PdfViewerLoader";
import ResourceUploader from "./ResourceUploader";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10";
const labelClass = "text-xs font-semibold uppercase tracking-wide text-navy/50";

function Badge({ tone, children }: { tone: "green" | "gray" | "amber"; children: React.ReactNode }) {
  const styles = {
    green: "bg-green-50 text-green-700",
    gray: "bg-navy/5 text-navy/50",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles}`}>{children}</span>
  );
}

function ModalShell({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-navy/10 bg-white p-6 shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-start justify-between">
          <p className="font-display text-lg font-bold text-navy">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-navy/50 hover:bg-cream-dim hover:text-navy">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Thumbnail of a YouTube address built by the server. Plain <img> on purpose: no image optimizer, no remotePatterns needed. */
function Thumb({ src, className }: { src: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={className} />
  );
}

function ResourceFormModal({
  resources,
  editingId,
  nextOrder,
  categories,
  maxBytes,
  storageConfigured,
  youtubeSupported,
  onClose,
}: {
  resources: AdminResource[];
  editingId: string | null;
  nextOrder: number;
  categories: string[];
  maxBytes: number;
  storageConfigured: boolean;
  youtubeSupported: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  // The id is null until "Create" succeeds; after that the modal stays open so the PDF can be uploaded right away.
  const [id, setId] = useState<string | null>(editingId);
  const existing = id ? resources.find((r) => r.id === id) : undefined;
  // The type is chosen once, when the resource is created, and is fixed afterwards.
  const [chosenType, setChosenType] = useState<NewResourceType>("pdf");
  const type: NewResourceType = existing ? existing.type : chosenType;
  const [form, setForm] = useState<ResourceFormInput>({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    category: existing?.category ?? "",
    displayOrder: existing?.displayOrder ?? nextOrder,
    youtubeUrl: existing?.watchUrl ?? "",
  });

  // Live check of the pasted link: the SERVER parses it and returns the thumbnail address. The result is kept together with the
  // text it was computed for, so a stale answer is never shown for newer input.
  const link = (form.youtubeUrl ?? "").trim();
  const [check, setCheck] = useState<{ link: string; result: YouTubePreviewResult } | null>(null);
  useEffect(() => {
    if (type !== "youtube" || !link) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await previewYouTubeUrl(link);
      if (!cancelled) setCheck({ link, result });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, link]);
  const linkCheck = check && check.link === link ? check.result : null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      if (!id) {
        const result = await createResource(form, type);
        if (result.ok) {
          router.refresh();
          if (type === "youtube") {
            showToast("Video added. Use Publish in the list when it's ready.");
            onClose();
          } else {
            setId(result.id);
            showToast("Created. Now upload the PDF.");
          }
        } else showToast(result.error, "error");
        return;
      }
      const result = await updateResource(id, form);
      if (result.ok) {
        showToast("Changes saved.");
        router.refresh();
      } else showToast(result.error, "error");
    });
  };

  return (
    <ModalShell title={id ? "Edit Resource" : "Add Resource"} onClose={onClose}>
      <form onSubmit={save} className="mt-5 space-y-4">
        <div>
          <p className={labelClass}>Type</p>
          {existing ? (
            <p className="mt-1.5 text-sm font-medium text-navy">
              {type === "youtube" ? "YouTube link" : "PDF"} <span className="text-navy/40">· can&apos;t be changed</span>
            </p>
          ) : (
            <div role="radiogroup" aria-label="Resource type" className="mt-1.5 inline-flex rounded-full border border-navy/15 bg-white p-1">
              {(
                [
                  ["pdf", "PDF"],
                  ["youtube", "YouTube link"],
                ] as const
              ).map(([value, label]) => {
                const disabled = value === "youtube" && !youtubeSupported;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={type === value}
                    disabled={disabled}
                    title={disabled ? "Run supabase/064_resources_youtube_links.sql first" : undefined}
                    onClick={() => setChosenType(value)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
                      type === value ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {!existing && !youtubeSupported ? (
            <p className="mt-2 text-xs text-amber-700">
              Video links need migration 064 (<code>064_APPLY_commit.sql</code>) before they can be added.
            </p>
          ) : null}
        </div>
        {type === "youtube" ? (
          <div>
            <label className={labelClass}>YouTube link</label>
            <input
              type="text"
              inputMode="url"
              required
              maxLength={2048}
              autoComplete="off"
              spellCheck={false}
              value={form.youtubeUrl ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=…  or  https://youtu.be/…"
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-navy/50">
              Public videos only. Only the video ID is kept — visitors are sent to YouTube to watch.
            </p>
            {link ? (
              <div className="mt-3" aria-live="polite">
                {linkCheck === null ? (
                  <p className="text-xs text-navy/50">Checking the link…</p>
                ) : linkCheck.ok ? (
                  <div className="flex items-center gap-3">
                    <Thumb src={linkCheck.thumbnailUrl} className="aspect-video w-40 rounded-lg border border-navy/10 bg-navy/5 object-cover" />
                    <p className="text-xs font-medium text-green-700">Link looks good. Check that this is the right video.</p>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-red">{linkCheck.error}</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <div>
          <label className={labelClass}>Title</label>
          <input type="text" required maxLength={200} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Présent de l'indicatif — Exercises" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Description (shown on the page as text — good for search)</label>
          <textarea rows={5} maxLength={5000} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={`${inputClass} resize-y`} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Category</label>
            <input type="text" list="resource-categories" maxLength={60} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Type or pick one" className={inputClass} />
            <datalist id="resource-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Display order</label>
            <input type="number" value={form.displayOrder} onChange={(e) => setForm((f) => ({ ...f, displayOrder: Number(e.target.value) }))} className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="rounded-full border border-navy/15 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream-dim">
            {id ? "Done" : "Cancel"}
          </button>
          <button type="submit" disabled={pending || (type === "youtube" && !linkCheck?.ok)} className="rounded-full bg-red px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60">
            {pending ? "Saving…" : id ? "Save Changes" : "Create"}
          </button>
        </div>
      </form>

      {id && type === "pdf" ? (
        <div className="mt-6 border-t border-navy/10 pt-5">
          <p className={labelClass}>PDF file</p>
          <div className="mt-2">
            {storageConfigured ? (
              <ResourceUploader
                resourceId={id}
                maxBytes={maxBytes}
                hasFile={existing?.hasFile ?? false}
                currentName={existing?.originalName ?? null}
                currentSize={existing?.sizeBytes ?? null}
                onFinished={() => router.refresh()}
              />
            ) : (
              <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs font-medium text-amber-800">
                File storage isn&apos;t configured on the server yet (R2_RESOURCES_BUCKET_NAME and the R2 credentials). Uploading
                is disabled until it is.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}

export default function ResourcesClient({
  resources,
  maxBytes,
  storageConfigured,
  youtubeSupported,
}: {
  resources: AdminResource[];
  maxBytes: number;
  storageConfigured: boolean;
  youtubeSupported: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pendingAction, startTransition] = useTransition();
  const [modal, setModal] = useState<{ editingId: string | null } | null>(null);
  const [preview, setPreview] = useState<AdminResource | null>(null);
  const [toDelete, setToDelete] = useState<AdminResource | null>(null);

  const categories = useMemo(
    () => [...new Set([...CATEGORY_SUGGESTIONS, ...resources.map((r) => r.category).filter(Boolean)])].sort(),
    [resources]
  );
  const nextOrder = resources.reduce((max, r) => Math.max(max, r.displayOrder), 0) + 10;

  const togglePublished = (r: AdminResource) =>
    startTransition(async () => {
      const result = await setResourcePublished(r.id, !r.isPublished);
      if (result.ok) {
        showToast(r.isPublished ? "Unpublished." : "Published.");
        router.refresh();
      } else showToast(result.error, "error");
    });

  const confirmDelete = () => {
    if (!toDelete) return;
    const target = toDelete;
    startTransition(async () => {
      const result = await deleteResource(target.id);
      setToDelete(null);
      if (result.ok) {
        showToast("Deleted.");
        router.refresh();
      } else showToast(result.error, "error");
    });
  };

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" onClick={() => setModal({ editingId: null })} className="inline-flex items-center gap-2 rounded-full bg-red px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-red/30 hover:bg-red-dark">
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Add Resource
        </button>
      </div>

      {resources.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">No resources yet. Add the first one.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {resources.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-2xl border border-navy/10 bg-white p-4 sm:flex-row sm:items-center">
              {r.type === "youtube" && r.thumbnailUrl ? (
                <Thumb src={r.thumbnailUrl} className="aspect-video w-24 shrink-0 rounded-lg border border-navy/10 bg-navy/5 object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red">
                  {r.type === "youtube" ? <Play className="h-5 w-5" strokeWidth={2} /> : <FileText className="h-5 w-5" strokeWidth={2} />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy">{r.title}</p>
                <p className="mt-0.5 truncate text-xs text-navy/50">
                  /resources/{r.slug}
                  {r.category ? ` · ${r.category}` : ""} · order {r.displayOrder}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Draft</Badge>}
                  {r.type === "youtube" ? (
                    <Badge tone="gray">Video</Badge>
                  ) : r.hasFile ? (
                    <Badge tone="green">PDF ready{r.sizeBytes ? ` · ${formatBytes(r.sizeBytes)}` : ""}</Badge>
                  ) : (
                    <Badge tone="amber">No PDF yet</Badge>
                  )}
                  {r.hasPendingUpload ? <Badge tone="amber">Upload unfinished</Badge> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {r.type === "youtube" && r.watchUrl ? (
                  <a href={r.watchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-navy/60 hover:bg-cream-dim hover:text-navy">
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                    Open on YouTube
                  </a>
                ) : r.hasFile ? (
                  <button type="button" onClick={() => setPreview(r)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-navy/60 hover:bg-cream-dim hover:text-navy">
                    Preview
                  </button>
                ) : null}
                <button type="button" onClick={() => togglePublished(r)} disabled={pendingAction || (!r.isPublished && r.type === "pdf" && !r.hasFile)} title={!r.isPublished && r.type === "pdf" && !r.hasFile ? "Upload a PDF first" : undefined} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-navy/60 hover:bg-cream-dim hover:text-navy disabled:opacity-40">
                  {r.isPublished ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2} />}
                  {r.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button type="button" onClick={() => setModal({ editingId: r.id })} aria-label={`Edit ${r.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-navy/40 hover:bg-cream-dim hover:text-navy">
                  <Pencil className="h-4 w-4" strokeWidth={2} />
                </button>
                <button type="button" onClick={() => setToDelete(r)} aria-label={`Delete ${r.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-navy/40 hover:bg-red-soft hover:text-red">
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <ResourceFormModal
          key={modal.editingId ?? "new"}
          resources={resources}
          editingId={modal.editingId}
          nextOrder={nextOrder}
          categories={categories}
          maxBytes={maxBytes}
          storageConfigured={storageConfigured}
          youtubeSupported={youtubeSupported}
          onClose={() => setModal(null)}
        />
      ) : null}

      {preview ? (
        <ModalShell title={`Preview — ${preview.title}`} onClose={() => setPreview(null)} wide>
          <div className="mt-4">
            <PdfViewerLoader endpoint={`/api/admin/resources/${preview.id}/file`} title={preview.title} />
          </div>
        </ModalShell>
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this resource?"
        description={
          toDelete?.type === "youtube"
            ? `“${toDelete.title}” will be removed from the site. The video on YouTube is not affected. This can't be undone.`
            : `“${toDelete?.title ?? ""}” and its PDF will be permanently removed. This can't be undone.`
        }
        confirmLabel="Delete"
        danger
        pending={pendingAction}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
