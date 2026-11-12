"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock, FileAudio, FileText, Inbox, Mail, NotebookPen, Paperclip, Trash2, Upload } from "lucide-react";
import type { AdminSelfStudyData, AdminSelfStudySubmissionView } from "@/lib/selfStudy/getSelfStudy";
import {
  SELF_STUDY_BUCKET,
  SELF_STUDY_MAX_BYTES,
  SELF_STUDY_RETENTION_DAYS,
  buildAssignmentPath,
  formatDuration,
  isPdf,
} from "@/lib/selfStudy/constants";
import { createClient } from "@/lib/supabase/client";
import {
  createAssignment,
  deleteAssignment,
  deleteSubmissionAsAdmin,
  setSubmissionReviewed,
} from "@/app/admin/(dashboard)/self-study/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { LocalDateTime, TimeLeft } from "./LocalTime";

type Tab = "submissions" | "homework";
type KindFilter = "ALL" | "PDF" | "VOICE";
type PendingDelete = { kind: "assignment"; id: string; title: string } | { kind: "submission"; id: string; title: string };

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-cream-dim px-2 py-0.5 text-[11px] font-semibold text-navy/55">
      <Clock className="h-3 w-3" strokeWidth={2} />
      <TimeLeft expiresAt={expiresAt} />
    </span>
  );
}

function EmptyNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-14 text-center">
      <p className="text-sm font-medium text-navy/55">{children}</p>
    </div>
  );
}

function SubmissionCard({
  submission: s,
  busy,
  onToggleReviewed,
  onDelete,
}: {
  submission: AdminSelfStudySubmissionView;
  busy: boolean;
  onToggleReviewed: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${s.reviewed_at ? "border-navy/10" : "border-red/25"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-soft text-red-dark">
            {s.kind === "PDF" ? <FileText className="h-4 w-4" strokeWidth={2} /> : <FileAudio className="h-4 w-4" strokeWidth={2} />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-navy">{s.studentName}</p>
            {s.studentEmail ? (
              <a href={`mailto:${s.studentEmail}`} className="mt-0.5 flex items-center gap-1 text-xs text-navy/50 hover:text-red">
                <Mail className="h-3 w-3" strokeWidth={2} />
                {s.studentEmail}
              </a>
            ) : null}
            <p className="mt-1 text-xs text-navy/55">
              {s.kind === "PDF"
                ? s.file_name
                : `Voice recording${s.duration_seconds != null ? ` · ${formatDuration(s.duration_seconds)}` : ""}`}
              {" · "}
              <LocalDateTime iso={s.created_at} />
              {s.assignmentTitle ? ` · for “${s.assignmentTitle}”` : s.assignment_id ? "" : " · general work"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExpiryBadge expiresAt={s.expires_at} />
          <button
            type="button"
            onClick={onToggleReviewed}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
              s.reviewed_at
                ? "bg-green-50 text-green-700 hover:bg-green-100"
                : "border border-navy/15 bg-white text-navy hover:bg-cream-dim"
            }`}
          >
            {s.reviewed_at ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} /> : <Circle className="h-3.5 w-3.5" strokeWidth={2} />}
            {s.reviewed_at ? "Checked" : "Mark checked"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label={`Delete ${s.studentName}'s submission`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-navy/40 transition-colors hover:bg-red-soft hover:text-red disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
      {s.note ? <p className="mt-3 whitespace-pre-line rounded-xl bg-cream-dim/60 px-3.5 py-2.5 text-sm text-navy/70">{s.note}</p> : null}
      {s.url ? (
        s.kind === "VOICE" ? (
          <audio controls preload="none" src={s.url} className="mt-3 w-full" />
        ) : (
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-red/30 hover:text-red-dark"
          >
            <FileText className="h-4 w-4" strokeWidth={2} />
            Open PDF
          </a>
        )
      ) : (
        <p className="mt-3 text-xs text-navy/45">File link unavailable — refresh the page.</p>
      )}
    </div>
  );
}

export default function AdminSelfStudyClient({ data }: { data: AdminSelfStudyData }) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("submissions");
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [onlyUnchecked, setOnlyUnchecked] = useState(false);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [batchId, setBatchId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  const uncheckedCount = data.submissions.filter((s) => !s.reviewed_at).length;
  const visibleSubmissions = data.submissions.filter(
    (s) => (kindFilter === "ALL" || s.kind === kindFilter) && (!onlyUnchecked || !s.reviewed_at)
  );

  function pickFile(next: File | undefined) {
    if (!next) return;
    if (!isPdf(next)) {
      showToast("Please choose a PDF file.", "error");
      return;
    }
    if (next.size > SELF_STUDY_MAX_BYTES) {
      showToast("That PDF is over 25 MB.", "error");
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(next.name.replace(/\.pdf$/i, ""));
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    try {
      const storagePath = buildAssignmentPath(file.name);
      const { error: uploadError } = await createClient()
        .storage.from(SELF_STUDY_BUCKET)
        .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) {
        showToast("Upload failed. Please try again.", "error");
        return;
      }
      const result = await createAssignment({
        title,
        note,
        batchId: batchId || null,
        storagePath,
        fileName: file.name,
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast("Homework shared with students.");
      setTitle("");
      setNote("");
      setBatchId("");
      setFile(null);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function toggleReviewed(s: AdminSelfStudySubmissionView) {
    setBusyId(s.id);
    const result = await setSubmissionReviewed(s.id, !s.reviewed_at);
    setBusyId(null);
    if (result.ok) router.refresh();
    else showToast(result.error, "error");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const result =
      pendingDelete.kind === "assignment"
        ? await deleteAssignment(pendingDelete.id)
        : await deleteSubmissionAsAdmin(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
    if (result.ok) {
      showToast("Deleted.");
      router.refresh();
    } else {
      showToast(result.error, "error");
    }
  }

  return (
    <div>
      <div className="inline-flex rounded-full border border-navy/10 bg-white p-1" role="tablist">
        {(
          [
            { key: "submissions", label: "Student work", icon: Inbox, count: uncheckedCount },
            { key: "homework", label: "Homework shared", icon: NotebookPen, count: data.assignments.length },
          ] as const
        ).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === key ? "bg-red-soft text-red-dark" : "text-navy/60 hover:text-navy"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
            {count > 0 ? (
              <span className={`rounded-full px-1.5 text-[11px] font-bold ${tab === key ? "bg-white text-red-dark" : "bg-cream-dim text-navy/60"}`}>
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "submissions" ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", "PDF", "VOICE"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  kindFilter === k ? "bg-navy text-white" : "border border-navy/15 bg-white text-navy/70 hover:bg-cream-dim"
                }`}
              >
                {k === "ALL" ? "All" : k === "PDF" ? "PDFs" : "Voice recordings"}
              </button>
            ))}
            <label className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-navy/70">
              <input
                type="checkbox"
                checked={onlyUnchecked}
                onChange={(e) => setOnlyUnchecked(e.target.checked)}
                className="h-4 w-4 accent-red"
              />
              Only not checked yet
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {visibleSubmissions.length === 0 ? (
              <EmptyNotice>
                {data.submissions.length === 0
                  ? `No student work in the last ${SELF_STUDY_RETENTION_DAYS} days.`
                  : "Nothing matches these filters."}
              </EmptyNotice>
            ) : (
              visibleSubmissions.map((s) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  busy={busyId === s.id}
                  onToggleReviewed={() => toggleReviewed(s)}
                  onDelete={() =>
                    setPendingDelete({ kind: "submission", id: s.id, title: `${s.studentName}'s ${s.kind === "PDF" ? "PDF" : "recording"}` })
                  }
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <p className="font-display text-base font-bold text-navy">Share homework or classwork</p>
            <p className="mt-1 text-sm text-navy/55">
              Students see it in their Self Study page and can send their work back as a PDF or voice recording.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-navy">
                Title
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Week 3 homework — passé composé"
                  maxLength={200}
                  disabled={uploading}
                  className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm font-normal text-navy outline-none focus:border-red"
                />
              </label>
              <label className="block text-sm font-semibold text-navy">
                Who gets it
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  disabled={uploading}
                  className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm font-normal text-navy outline-none focus:border-red"
                >
                  <option value="">All students</option>
                  {data.batchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-sm font-semibold text-navy">
              Instructions <span className="font-normal text-navy/45">(optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={2000}
                disabled={uploading}
                className="mt-1.5 w-full resize-y rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm font-normal text-navy outline-none focus:border-red"
              />
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-navy/25 px-4 py-2 text-sm font-semibold text-navy/70 hover:border-red/30 hover:text-red disabled:opacity-60"
              >
                <Paperclip className="h-4 w-4" strokeWidth={2} />
                {file ? "Choose another PDF" : "Choose PDF"}
              </button>
              {file ? (
                <span className="min-w-0 truncate text-sm text-navy/70">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={upload}
              disabled={!file || uploading}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-red px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-dark disabled:opacity-50"
            >
              <Upload className="h-4 w-4" strokeWidth={2} />
              {uploading ? "Uploading…" : "Share with students"}
            </button>
          </div>

          <div className="space-y-3">
            {data.assignments.length === 0 ? (
              <EmptyNotice>{`No homework shared in the last ${SELF_STUDY_RETENTION_DAYS} days.`}</EmptyNotice>
            ) : (
              data.assignments.map((a) => (
                <div key={a.id} className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-navy">{a.title}</p>
                      <p className="mt-0.5 text-xs text-navy/50">
                        {a.audienceLabel} · <LocalDateTime iso={a.created_at} /> · {a.submissionCount}{" "}
                        {a.submissionCount === 1 ? "reply" : "replies"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ExpiryBadge expiresAt={a.expires_at} />
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ kind: "assignment", id: a.id, title: a.title })}
                        aria-label={`Delete ${a.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-navy/40 transition-colors hover:bg-red-soft hover:text-red"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                  {a.note ? <p className="mt-3 whitespace-pre-line text-sm text-navy/70">{a.note}</p> : null}
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-navy/70 hover:text-red-dark"
                    >
                      <FileText className="h-4 w-4" strokeWidth={2} />
                      {a.file_name}
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.title ?? ""}?`}
        description={
          pendingDelete?.kind === "assignment"
            ? "Students won't see this homework anymore. Work they already sent for it stays."
            : "The file is deleted right away instead of after 3 days."
        }
        confirmLabel="Delete"
        danger
        pending={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
