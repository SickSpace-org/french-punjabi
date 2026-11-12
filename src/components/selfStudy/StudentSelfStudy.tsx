"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileAudio, FileText, Mic, Paperclip, Send, Trash2, Upload } from "lucide-react";
import type { SelfStudyAssignmentView, SelfStudySubmissionView } from "@/lib/selfStudy/getSelfStudy";
import {
  SELF_STUDY_BUCKET,
  SELF_STUDY_MAX_BYTES,
  SELF_STUDY_RETENTION_DAYS,
  audioExtension,
  baseMimeType,
  buildSubmissionPath,
  formatDuration,
  isPdf,
} from "@/lib/selfStudy/constants";
import { createClient } from "@/lib/supabase/client";
import { createSubmission, deleteMySubmission } from "@/app/student/(portal)/self-study/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import VoiceRecorder, { type Recording } from "./VoiceRecorder";
import { LocalDateTime, TimeLeft } from "./LocalTime";

type Mode = "PDF" | "VOICE";

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-cream-dim px-2 py-0.5 text-[11px] font-semibold text-navy/55">
      <Clock className="h-3 w-3" strokeWidth={2} />
      <TimeLeft expiresAt={expiresAt} />
    </span>
  );
}

function EmptyNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-10 text-center">
      <p className="text-sm font-medium text-navy/55">{children}</p>
    </div>
  );
}

export default function StudentSelfStudy({
  studentId,
  assignments,
  submissions,
}: {
  studentId: string;
  assignments: SelfStudyAssignmentView[];
  submissions: SelfStudySubmissionView[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("PDF");
  const [assignmentId, setAssignmentId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [toDelete, setToDelete] = useState<SelfStudySubmissionView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sentFor = new Set(submissions.map((s) => s.assignment_id).filter(Boolean));

  function answerHomework(id: string) {
    setAssignmentId(id);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pickFile(next: File | undefined) {
    if (!next) return;
    if (!isPdf(next)) {
      showToast("Please choose a PDF file.", "error");
      return;
    }
    if (next.size > SELF_STUDY_MAX_BYTES) {
      showToast("That PDF is over 25 MB. Please make it smaller and try again.", "error");
      return;
    }
    setFile(next);
  }

  function resetForm() {
    setFile(null);
    setRecording(null);
    setRecorderKey((k) => k + 1);
    setNote("");
    setAssignmentId("");
  }

  async function send() {
    let blob: Blob;
    let fileName: string;
    let contentType: string;
    let durationSeconds: number | null = null;

    if (mode === "PDF") {
      if (!file) return;
      blob = file;
      fileName = file.name;
      contentType = "application/pdf";
    } else {
      if (!recording) return;
      if (recording.blob.size > SELF_STUDY_MAX_BYTES) {
        showToast("That recording is too large. Please record a shorter one.", "error");
        return;
      }
      blob = recording.blob;
      contentType = baseMimeType(recording.mimeType);
      fileName = `voice-recording.${audioExtension(recording.mimeType)}`;
      durationSeconds = recording.durationSeconds;
    }

    setSending(true);
    try {
      const storagePath = buildSubmissionPath(studentId, fileName);
      const { error: uploadError } = await createClient()
        .storage.from(SELF_STUDY_BUCKET)
        .upload(storagePath, blob, { contentType, upsert: false });

      if (uploadError) {
        showToast("Upload failed. Please check your connection and try again.", "error");
        return;
      }

      const result = await createSubmission({
        kind: mode,
        assignmentId: assignmentId || null,
        note,
        storagePath,
        fileName,
        durationSeconds,
      });

      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(mode === "PDF" ? "Your PDF was sent to your teacher." : "Your recording was sent to your teacher.");
      resetForm();
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const result = await deleteMySubmission(toDelete.id);
    setDeleting(false);
    setToDelete(null);
    if (result.ok) {
      showToast("Deleted.");
      router.refresh();
    } else {
      showToast(result.error, "error");
    }
  }

  const canSend = !sending && (mode === "PDF" ? file !== null : recording !== null);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-display text-2xl font-bold text-navy">Self Study</p>
        <p className="mt-1 text-sm text-navy/60">
          {`Get homework from your teacher and send back your work as a PDF or a voice recording. Everything here is deleted automatically ${SELF_STUDY_RETENTION_DAYS} days after it's uploaded, so save anything you want to keep.`}
        </p>
      </div>

      {/* Homework from the teacher */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Homework from your teacher</p>
        <div className="mt-3 space-y-3">
          {assignments.length === 0 ? (
            <EmptyNotice>No homework right now. New homework from your teacher will show up here.</EmptyNotice>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-navy">{a.title}</p>
                    <p className="mt-0.5 text-xs text-navy/50">
                      Shared <LocalDateTime iso={a.created_at} /> · {a.audienceLabel}
                    </p>
                  </div>
                  <ExpiryBadge expiresAt={a.expires_at} />
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
                      Open PDF
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => answerHomework(a.id)}
                    className="inline-flex items-center gap-2 rounded-full bg-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-dark"
                  >
                    <Send className="h-4 w-4" strokeWidth={2} />
                    Send my work
                  </button>
                  {sentFor.has(a.id) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                      Sent
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Send work */}
      <section ref={panelRef} className="scroll-mt-24">
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Send your work</p>
        <div className="mt-3 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="inline-flex rounded-full border border-navy/10 bg-cream-dim p-1" role="tablist">
            {(
              [
                { key: "PDF", label: "PDF upload", icon: Upload },
                { key: "VOICE", label: "Voice recording", icon: Mic },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                disabled={sending}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  mode === key ? "bg-white text-navy shadow-sm" : "text-navy/55 hover:text-navy"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-sm font-semibold text-navy">
            Which homework is this for?
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              disabled={sending}
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm font-normal text-navy outline-none focus:border-red"
            >
              <option value="">Not for a specific homework</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5">
            {mode === "PDF" ? (
              <div className="rounded-xl border border-dashed border-navy/20 bg-cream-dim/50 p-4">
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-navy">
                      <Paperclip className="h-4 w-4 shrink-0 text-navy/40" strokeWidth={2} />
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-navy/45">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
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
                    className="flex w-full flex-col items-center gap-1.5 py-3 text-center"
                  >
                    <Upload className="h-5 w-5 text-navy/40" strokeWidth={2} />
                    <span className="text-sm font-semibold text-navy">Choose a PDF</span>
                    <span className="text-xs text-navy/50">Up to 25 MB</span>
                  </button>
                )}
              </div>
            ) : (
              <VoiceRecorder key={recorderKey} disabled={sending} onChange={setRecording} />
            )}
          </div>

          <label className="mt-5 block text-sm font-semibold text-navy">
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

          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-red px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-dark disabled:opacity-50"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
            {sending ? "Sending…" : mode === "PDF" ? "Send PDF" : "Send recording"}
          </button>
        </div>
      </section>

      {/* What the student already sent */}
      <section>
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">What you&apos;ve sent</p>
        <div className="mt-3 space-y-3">
          {submissions.length === 0 ? (
            <EmptyNotice>{`You haven't sent anything in the last ${SELF_STUDY_RETENTION_DAYS} days.`}</EmptyNotice>
          ) : (
            submissions.map((s) => (
              <div key={s.id} className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-soft text-red-dark">
                      {s.kind === "PDF" ? (
                        <FileText className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <FileAudio className="h-4 w-4" strokeWidth={2} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">
                        {s.kind === "PDF"
                          ? s.file_name
                          : `Voice recording${s.duration_seconds != null ? ` · ${formatDuration(s.duration_seconds)}` : ""}`}
                      </p>
                      <p className="mt-0.5 text-xs text-navy/50">
                        Sent <LocalDateTime iso={s.created_at} />
                        {s.assignmentTitle ? ` · for “${s.assignmentTitle}”` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.reviewed_at ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-700">
                        Checked by teacher
                      </span>
                    ) : null}
                    <ExpiryBadge expiresAt={s.expires_at} />
                    <button
                      type="button"
                      onClick={() => setToDelete(s)}
                      aria-label="Delete"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-navy/40 transition-colors hover:bg-red-soft hover:text-red"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                {s.note ? <p className="mt-3 whitespace-pre-line text-sm text-navy/65">{s.note}</p> : null}
                {s.url ? (
                  s.kind === "VOICE" ? (
                    <audio controls preload="none" src={s.url} className="mt-3 w-full" />
                  ) : (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-navy/70 hover:text-red-dark"
                    >
                      <FileText className="h-4 w-4" strokeWidth={2} />
                      Open PDF
                    </a>
                  )
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this?"
        description="Your teacher won't be able to see it anymore."
        confirmLabel="Delete"
        danger
        pending={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
