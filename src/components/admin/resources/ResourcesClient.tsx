"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Eye, EyeOff, FileText, Pencil, Plus, Trash2, X } from "lucide-react";
import type { AdminResource } from "@/lib/resources/queries";
import {
  createResource,
  deleteResource,
  setResourcePublished,
  updateResource,
  type ResourceFormInput,
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

function ResourceFormModal({
  resources,
  editingId,
  nextOrder,
  categories,
  maxBytes,
  storageConfigured,
  onClose,
}: {
  resources: AdminResource[];
  editingId: string | null;
  nextOrder: number;
  categories: string[];
  maxBytes: number;
  storageConfigured: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  // The id is null until "Create" succeeds; after that the modal stays open so the PDF can be uploaded right away.
  const [id, setId] = useState<string | null>(editingId);
  const existing = id ? resources.find((r) => r.id === id) : undefined;
  const [form, setForm] = useState<ResourceFormInput>({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    category: existing?.category ?? "",
    displayOrder: existing?.displayOrder ?? nextOrder,
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      if (!id) {
        const result = await createResource(form);
        if (result.ok) {
          setId(result.id);
          showToast("Created. Now upload the PDF.");
          router.refresh();
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
          <button type="submit" disabled={pending} className="rounded-full bg-red px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60">
            {pending ? "Saving…" : id ? "Save Changes" : "Create"}
          </button>
        </div>
      </form>

      {id ? (
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
}: {
  resources: AdminResource[];
  maxBytes: number;
  storageConfigured: boolean;
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red">
                <FileText className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy">{r.title}</p>
                <p className="mt-0.5 truncate text-xs text-navy/50">
                  /resources/{r.slug}
                  {r.category ? ` · ${r.category}` : ""} · order {r.displayOrder}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.isPublished ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Draft</Badge>}
                  {r.hasFile ? (
                    <Badge tone="green">PDF ready{r.sizeBytes ? ` · ${formatBytes(r.sizeBytes)}` : ""}</Badge>
                  ) : (
                    <Badge tone="amber">No PDF yet</Badge>
                  )}
                  {r.hasPendingUpload ? <Badge tone="amber">Upload unfinished</Badge> : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {r.hasFile ? (
                  <button type="button" onClick={() => setPreview(r)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-navy/60 hover:bg-cream-dim hover:text-navy">
                    Preview
                  </button>
                ) : null}
                <button type="button" onClick={() => togglePublished(r)} disabled={pendingAction || (!r.isPublished && !r.hasFile)} title={!r.isPublished && !r.hasFile ? "Upload a PDF first" : undefined} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-navy/60 hover:bg-cream-dim hover:text-navy disabled:opacity-40">
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
        description={`“${toDelete?.title ?? ""}” and its PDF will be permanently removed. This can't be undone.`}
        confirmLabel="Delete"
        danger
        pending={pendingAction}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
