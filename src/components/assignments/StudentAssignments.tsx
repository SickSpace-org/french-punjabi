"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileText, Paperclip, Send, Trash2, Upload, X } from "lucide-react";
import type { AssignmentSubmissionView, StudentAssignmentView } from "@/lib/assignments/getAssignments";
import {
  ASSIGNMENTS_BUCKET,
  ASSIGNMENT_MAX_BYTES,
  ASSIGNMENT_RETENTION_DAYS,
  buildSubmissionPath,
  isPdf,
} from "@/lib/assignments/constants";
import { createClient } from "@/lib/supabase/client";
import { deleteMySubmission, submitAssignment } from "@/app/student/(portal)/assignments/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import LocalDateTime, { ExpiryBadge } from "./LocalDateTime";

type Status = "todo" | "submitted" | "checked";

function statusOf(a: StudentAssignmentView): Status {
  if (a.submissions.length === 0) return "todo";
  return a.submissions.some((s) => s.reviewed_at) ? "checked" : "submitted";
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "checked") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-700">
        <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
        Checked
      </span>
    );
  }
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-navy/5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-navy/70">
        <Clock className="h-3 w-3" strokeWidth={2.5} />
        Submitted · waiting for check
      </span>
    );
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-dark">
      To do
    </span>
  );
}

function SubmitBox({
  assignmentId,
  studentId,
  onDone,
  onCancel,
}: {
  assignmentId: string;
  studentId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  function pickFile(next: File | undefined) {
    if (!next) return;
    if (!isPdf(next)) {
      showToast("Please choose a PDF file.", "error");
      return;
    }
    if (next.size > ASSIGNMENT_MAX_BYTES) {
      showToast("That PDF is over 25 MB. Please make it smaller and try again.", "error");
      return;
    }
    setFile(next);
  }

  async function send() {
    if (!file) return;
    setSending(true);
    try {
      const storagePath = buildSubmissionPath(studentId, file.name);
      const { error: uploadError } = await createClient()
        .storage.from(ASSIGNMENTS_BUCKET)
        .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) {
        showToast("Upload failed. Please check your connection and try again.", "error");
        return;
      }
      const result = await submitAssignment({ assignmentId, note, storagePath, fileName: file.name });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast("Your work was sent to your teacher.");
      onDone();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-navy/10 bg-cream-dim/50 p-4">
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
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3.5 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-navy">
            <Paperclip className="h-4 w-4 shrink-0 text-navy/40" strokeWidth={2} />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-navy/45">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="text-xs font-semibold text-navy/60 hover:text-red disabled:opacity-60"
          >
            Choose another
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-navy/20 bg-white py-5 text-center transition-colors hover:border-red/30"
        >
          <Upload className="h-5 w-5 text-navy/40" strokeWidth={2} />
          <span className="text-sm font-semibold text-navy">Choose your PDF</span>
          <span className="text-xs text-navy/50">Up to 25 MB</span>
        </button>
      )}

      <label className="mt-4 block text-sm font-semibold text-navy">
        Message for your teacher <span className="font-normal text-navy/45">(optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={sending}
          rows={2}
          maxLength={2000}
          className="mt-1.5 w-full resize-y rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm font-normal text-navy outline-none focus:border-red"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={!file || sending}
          className="inline-flex items-center gap-2 rounded-full bg-red px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-dark disabled:opacity-50"
        >
          <Send className="h-4 w-4" strokeWidth={2} />
          {sending ? "Sending…" : "Submit"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-navy/60 hover:text-navy disabled:opacity-60"
        >
          <X className="h-4 w-4" strokeWidth={2} />
          Cancel
        </button>
      </div>
    </div>
  );
}

function SubmissionItem({
  submission: s,
  showFor,
  onDelete,
}: {
  submission: AssignmentSubmissionView;
  showFor?: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream-dim/60 px-3.5 py-2.5">
      <div className="min-w-0">
        {s.url ? (
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-navy hover:text-red-dark"
          >
            <FileText className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="truncate">{s.file_name}</span>
          </a>
        ) : (
          <span className="text-sm font-semibold text-navy">{s.file_name}</span>
        )}
        <p className="mt-0.5 text-xs text-navy/50">
          Sent <LocalDateTime iso={s.created_at} />
          {showFor && s.assignment_title ? ` · for “${s.assignment_title}”` : ""}
          {s.note ? ` · “${s.note}”` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {s.reviewed_at ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Checked by teacher
          </span>
        ) : (
          <span className="text-xs font-medium text-navy/50">Not checked yet</span>
        )}
        <ExpiryBadge expiresAt={s.expires_at} />
        {!s.reviewed_at ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${s.file_name}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-navy/40 transition-colors hover:bg-red-soft hover:text-red"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export default function StudentAssignments({
  studentId,
  assignments,
  earlierSubmissions,
}: {
  studentId: string;
  assignments: StudentAssignmentView[];
  earlierSubmissions: AssignmentSubmissionView[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AssignmentSubmissionView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const todoCount = assignments.filter((a) => statusOf(a) === "todo").length;

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const result = await deleteMySubmission(toDelete.id);
    setDeleting(false);
    setToDelete(null);
    if (result.ok) {
      showToast("Submission deleted.");
      router.refresh();
    } else {
      showToast(result.error, "error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-2xl font-bold text-navy">Assignments</p>
        <p className="mt-1 text-sm text-navy/60">
          {`Open each assignment from your teacher, do it, and submit your finished work as a PDF. You'll see here when your teacher has checked it. Everything here is deleted automatically ${ASSIGNMENT_RETENTION_DAYS} days after it's uploaded, so save anything you want to keep.`}
        </p>
        {assignments.length > 0 ? (
          <p className="mt-3 text-sm font-semibold text-navy">
            {todoCount === 0 ? "You're all caught up." : `${todoCount} assignment${todoCount === 1 ? "" : "s"} to do`}
          </p>
        ) : null}
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-navy/55">
            No assignments yet. New assignments from your teacher will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const status = statusOf(a);
            return (
              <div
                key={a.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm ${status === "todo" ? "border-red/20" : "border-navy/10"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-navy">{a.title}</p>
                    <p className="mt-0.5 text-xs text-navy/50">
                      Shared <LocalDateTime iso={a.created_at} /> · {a.audienceLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={status} />
                    <ExpiryBadge expiresAt={a.expires_at} />
                  </div>
                </div>
                {a.note ? <p className="mt-3 whitespace-pre-line text-sm text-navy/70">{a.note}</p> : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-red/30 hover:text-red-dark"
                    >
                      <FileText className="h-4 w-4" strokeWidth={2} />
                      Open assignment
                    </a>
                  ) : null}
                  {openFor !== a.id ? (
                    <button
                      type="button"
                      onClick={() => setOpenFor(a.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        status === "todo"
                          ? "bg-red text-white hover:bg-red-dark"
                          : "border border-navy/15 bg-white text-navy hover:bg-cream-dim"
                      }`}
                    >
                      <Upload className="h-4 w-4" strokeWidth={2} />
                      {status === "todo" ? "Submit my work" : "Submit again"}
                    </button>
                  ) : null}
                </div>

                {openFor === a.id ? (
                  <SubmitBox
                    assignmentId={a.id}
                    studentId={studentId}
                    onCancel={() => setOpenFor(null)}
                    onDone={() => {
                      setOpenFor(null);
                      router.refresh();
                    }}
                  />
                ) : null}

                {a.submissions.length > 0 ? (
                  <div className="mt-4 border-t border-navy/10 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-navy/45">Your submissions</p>
                    <ul className="mt-2 space-y-2">
                      {a.submissions.map((s) => (
                        <SubmissionItem key={s.id} submission={s} onDelete={() => setToDelete(s)} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {earlierSubmissions.length > 0 ? (
        <section>
          <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Earlier submissions</p>
          <p className="mt-1 text-xs text-navy/50">The assignment for these has already been removed.</p>
          <ul className="mt-3 space-y-2">
            {earlierSubmissions.map((s) => (
              <SubmissionItem key={s.id} submission={s} showFor onDelete={() => setToDelete(s)} />
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this submission?"
        description="Your teacher won't see it anymore. You can submit again afterwards."
        confirmLabel="Delete"
        danger
        pending={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
