"use client";

import { useRef, useState, useTransition } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  FileText,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
  Users,
  Video,
} from "lucide-react";
import type {
  TeacherDashboardBatch,
  TeacherFeedbackThread,
  TeacherMaterial,
  TeacherRecording,
  TeacherRosterStudent,
  TeacherSentMessage,
} from "@/lib/teachers/getTeacherDashboard";
import { formatSchedule } from "@/lib/attendance/schedule";
import {
  addBatchMaterial,
  addClassRecording,
  addFeedbackNote,
  deleteBatchMaterial,
  deleteClassRecording,
  deleteFeedbackNote,
  renameBatchMaterial,
  sendTeacherMessage,
  updateBatchMeetingLink,
  updateClassRecording,
  updateFeedbackNote,
  type AddRecordingInput,
} from "@/app/teacher/actions";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/admin/ToastProvider";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-CA", { dateStyle: "medium" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function MeetingLinkEditor({ batchId, initialLink }: { batchId: string; initialLink: string | null }) {
  const { showToast } = useToast();
  const [link, setLink] = useState(initialLink ?? "");
  const [savedLink, setSavedLink] = useState(initialLink ?? "");
  const [saving, setSaving] = useState(false);

  const dirty = link !== savedLink;

  const handleSave = async () => {
    setSaving(true);
    const result = await updateBatchMeetingLink(batchId, link);
    setSaving(false);
    if (result.ok) {
      setSavedLink(link.trim());
      showToast("Meeting link saved.");
    } else {
      showToast(result.error, "error");
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-navy/15 bg-white px-3.5 py-2 focus-within:border-red focus-within:ring-4 focus-within:ring-red/10">
        <Video className="h-4 w-4 shrink-0 text-navy/35" strokeWidth={2} />
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://zoom.us/j/… or https://meet.google.com/…"
          className="w-full text-sm text-navy outline-none"
        />
      </div>
      <button
        type="button"
        disabled={saving || !dirty}
        onClick={handleSave}
        className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" strokeWidth={2} />
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function RecordingForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: TeacherRecording;
  submitLabel: string;
  onSubmit: (input: AddRecordingInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [classDate, setClassDate] = useState(initial?.classDate ?? "");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    startTransition(async () => {
      await onSubmit({ url, title, classDate });
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-[2]">
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Recording Link</label>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div className="min-w-0 flex-1">
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Week 3 recap"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Class Date</label>
        <input
          type="date"
          value={classDate}
          onChange={(e) => setClassDate(e.target.value)}
          className="mt-1 rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !url.trim()}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={2} />
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy/60 hover:bg-cream-dim"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function RecordingsSection({ batchId, recordings }: { batchId: string; recordings: TeacherRecording[] }) {
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleAdd = async (input: AddRecordingInput) => {
    const result = await addClassRecording(batchId, input);
    if (result.ok) {
      setAdding(false);
      showToast("Recording added.");
    } else {
      showToast(result.error, "error");
    }
  };

  const handleUpdate = async (recordingId: string, input: AddRecordingInput) => {
    const result = await updateClassRecording(recordingId, input);
    if (result.ok) {
      setEditingId(null);
      showToast("Recording updated.");
    } else {
      showToast(result.error, "error");
    }
  };

  const handleDelete = (recordingId: string) => {
    startTransition(async () => {
      const result = await deleteClassRecording(recordingId);
      if (!result.ok) showToast(result.error, "error");
    });
  };

  return (
    <div className="mt-4 border-t border-navy/10 pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Class Recordings</p>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-dark hover:underline"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Add Recording
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-2">
          <RecordingForm submitLabel="Add" onSubmit={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      ) : null}

      {recordings.length === 0 && !adding ? (
        <p className="mt-2 text-sm text-navy/50">No recordings added yet.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {recordings.map((recording) =>
            editingId === recording.id ? (
              <div key={recording.id} className="rounded-xl border border-navy/10 p-3">
                <RecordingForm
                  initial={recording}
                  submitLabel="Save"
                  onSubmit={(input) => handleUpdate(recording.id, input)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div
                key={recording.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy/10 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <a
                    href={recording.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-red-dark hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    {recording.title || "Recording"}
                  </a>
                  {recording.classDate ? (
                    <p className="mt-0.5 text-xs text-navy/45">Class of {formatDate(recording.classDate)}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingId(recording.id)}
                    aria-label="Edit recording"
                    className="rounded-full p-1.5 text-navy/40 hover:bg-cream-dim hover:text-navy"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(recording.id)}
                    aria-label="Delete recording"
                    className="rounded-full p-1.5 text-navy/40 hover:bg-cream-dim hover:text-red disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Object key convention: {batchId}/{timestamp}-{sanitizedFilename} — mirrors buildVideoKey (src/lib/r2/server.ts) and lesson-resources' {course_id}/{lesson_id}/{filename} shape. */
function buildMaterialStoragePath(batchId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${batchId}/${Date.now()}-${safeName}`;
}

function MaterialsSection({ batchId, materials }: { batchId: string; materials: TeacherMaterial[] }) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pending, startTransition] = useTransition();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || !title.trim()) return;

    setUploading(true);
    try {
      const storagePath = buildMaterialStoragePath(batchId, file.name);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("batch-materials").upload(storagePath, file);
      if (uploadError) {
        showToast(`Upload failed: ${uploadError.message}`, "error");
        return;
      }

      const result = await addBatchMaterial(batchId, storagePath, title);
      if (result.ok) {
        setTitle("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        showToast("Material uploaded.");
      } else {
        // The file made it to storage but the metadata row failed — clean
        // up the orphaned object rather than leave an untracked file.
        await supabase.storage.from("batch-materials").remove([storagePath]);
        showToast(result.error, "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRename = (materialId: string) => {
    if (!renameValue.trim()) return;
    startTransition(async () => {
      const result = await renameBatchMaterial(materialId, renameValue);
      if (result.ok) {
        setRenamingId(null);
        showToast("Renamed.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  const handleDelete = (materialId: string, storagePath: string) => {
    startTransition(async () => {
      const result = await deleteBatchMaterial(materialId, storagePath);
      if (!result.ok) showToast(result.error, "error");
    });
  };

  return (
    <div className="mt-4 border-t border-navy/10 pt-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Materials</p>

      <form onSubmit={handleUpload} className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">File</label>
          <input
            ref={fileInputRef}
            type="file"
            required
            className="mt-1 w-full text-sm text-navy file:mr-2 file:rounded-full file:border file:border-navy/15 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-navy"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Week 3 worksheet"
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {materials.length === 0 ? (
        <p className="mt-2 text-sm text-navy/50">No materials uploaded yet.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {materials.map((material) =>
            renamingId === material.id ? (
              <div key={material.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-navy/10 p-3">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  className="min-w-0 flex-1 rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
                />
                <button
                  type="button"
                  disabled={pending || !renameValue.trim()}
                  onClick={() => handleRename(material.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" strokeWidth={2} />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy/60 hover:bg-cream-dim"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                key={material.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy/10 px-4 py-2.5"
              >
                <div className="min-w-0">
                  {material.downloadUrl ? (
                    <a
                      href={material.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-red-dark hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      {material.title}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy/50">
                      <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      {material.title} (link unavailable)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(material.id);
                      setRenameValue(material.title);
                    }}
                    aria-label="Rename material"
                    className="rounded-full p-1.5 text-navy/40 hover:bg-cream-dim hover:text-navy"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(material.id, material.storagePath)}
                    aria-label="Delete material"
                    className="rounded-full p-1.5 text-navy/40 hover:bg-cream-dim hover:text-red disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Messages are permanent once sent — sendTeacherMessage() has no matching
 * edit/delete action (see supabase/036_teacher_messages.sql), a
 * deliberate limitation for this phase, not an oversight. There is
 * nothing to build here for editing or recalling a sent message.
 */
function MessagesSection({
  batchId,
  students,
  sentMessages,
}: {
  batchId: string;
  students: TeacherRosterStudent[];
  sentMessages: TeacherSentMessage[];
}) {
  const { showToast } = useToast();
  const [recipient, setRecipient] = useState<string>("batch");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const studentId = recipient === "batch" ? null : recipient;
      const result = await sendTeacherMessage(batchId, studentId, body);
      if (result.ok) {
        setBody("");
        showToast("Message sent.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <div className="mt-4 border-t border-navy/10 pt-4">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-navy/40">
        <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
        Messages
      </p>

      <form onSubmit={handleSend} className="mt-2 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">To</label>
            <select
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
            >
              <option value="batch">Whole batch ({students.length} student{students.length === 1 ? "" : "s"})</option>
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Write a message…"
          className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          {pending ? "Sending…" : "Send"}
        </button>
      </form>

      {sentMessages.length === 0 ? (
        <p className="mt-3 text-sm text-navy/50">No messages sent yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {sentMessages.map((m) => {
            const readCount = m.recipients.filter((r) => r.isRead).length;
            const to =
              m.recipients.length === 1
                ? m.recipients[0].fullName
                : `${m.recipients.length} students (${readCount} read)`;
            return (
              <div key={m.broadcastId} className="rounded-xl border border-navy/10 px-4 py-2.5">
                <p className="text-sm text-navy">{m.body}</p>
                <p className="mt-1 text-xs text-navy/45">
                  To: {to} · {formatDateTime(m.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Private per-student notes — never visible to the rest of the batch,
 * deliberately kept out of the batch-wide MessagesSection above so the
 * two aren't visually conflated: Messages is one-way/permanent/broadcast-
 * capable, Feedback is private/editable/one-student-at-a-time with a
 * reply thread. Collapsed by default (badge shows the thread count) so a
 * roster of several students doesn't turn into a wall of text.
 */
function StudentFeedbackPanel({ batchId, student }: { batchId: string; student: TeacherRosterStudent }) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [composing, setComposing] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pending, startTransition] = useTransition();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim()) return;
    startTransition(async () => {
      const result = await addFeedbackNote(batchId, student.studentId, newBody);
      if (result.ok) {
        setNewBody("");
        setComposing(false);
        showToast("Note added.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  const handleUpdate = (noteId: string) => {
    if (!editBody.trim()) return;
    startTransition(async () => {
      const result = await updateFeedbackNote(noteId, editBody);
      if (result.ok) {
        setEditingId(null);
        showToast("Note updated.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  const handleDelete = (noteId: string) => {
    startTransition(async () => {
      const result = await deleteFeedbackNote(noteId);
      if (!result.ok) showToast(result.error, "error");
    });
  };

  return (
    <div className="mt-2 border-t border-navy/10 pt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy/60 hover:text-navy"
      >
        <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
        Feedback ({student.feedbackThreads.length})
        {expanded ? <ChevronUp className="h-3 w-3" strokeWidth={2} /> : <ChevronDown className="h-3 w-3" strokeWidth={2} />}
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2">
          {student.feedbackThreads.map((thread: TeacherFeedbackThread) =>
            editingId === thread.noteId ? (
              <div key={thread.noteId} className="rounded-xl border border-navy/10 bg-cream-dim/40 p-3">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  autoFocus
                  className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={pending || !editBody.trim()}
                    onClick={() => handleUpdate(thread.noteId)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" strokeWidth={2} />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-semibold text-navy/60 hover:bg-cream-dim"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={thread.noteId} className="rounded-xl border border-navy/10 bg-cream-dim/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-navy">{thread.body}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(thread.noteId);
                        setEditBody(thread.body);
                      }}
                      aria-label="Edit note"
                      className="rounded-full p-1.5 text-navy/40 hover:bg-white hover:text-navy"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDelete(thread.noteId)}
                      aria-label="Delete note"
                      className="rounded-full p-1.5 text-navy/40 hover:bg-white hover:text-red disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-navy/40">{formatDateTime(thread.createdAt)}</p>

                {thread.replies.length > 0 ? (
                  <div className="mt-2 space-y-1.5 border-t border-navy/10 pt-2">
                    {thread.replies.map((reply) => (
                      <div key={reply.id} className="rounded-lg bg-white px-2.5 py-2">
                        <p className="text-xs text-navy">{reply.body}</p>
                        <p className="mt-0.5 text-[10px] text-navy/40">{student.fullName} · {formatDateTime(reply.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          )}

          {composing ? (
            <form onSubmit={handleAdd} className="rounded-xl border border-navy/10 p-3">
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Write a private note about this student…"
                className="w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={pending || !newBody.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" strokeWidth={2} />
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setComposing(false)}
                  className="rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-semibold text-navy/60 hover:bg-cream-dim"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-dark hover:underline"
            >
              <Plus className="h-3 w-3" strokeWidth={2} />
              Add Note
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function TeacherDashboardClient({ batches }: { batches: TeacherDashboardBatch[] }) {
  return (
    <div className="mt-6 space-y-5">
      {batches.map((batch) => (
        <div key={batch.batchId} className="rounded-2xl border border-navy/10 bg-white p-5">
          <p className="font-display text-base font-bold text-navy">{batch.label}</p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-navy/50">
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
            {formatSchedule(batch.classDays, batch.classTime)}
          </p>

          <MeetingLinkEditor batchId={batch.batchId} initialLink={batch.meetingLink} />

          <div className="mt-4 border-t border-navy/10 pt-4">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-navy/40">
              <Users className="h-3.5 w-3.5" strokeWidth={2} />
              {batch.students.length} student{batch.students.length === 1 ? "" : "s"}
            </p>

            {batch.students.length === 0 ? (
              <p className="mt-3 text-sm text-navy/50">No students enrolled in this batch yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {batch.students.map((student) => (
                  <div key={student.studentId} className="rounded-xl border border-navy/10 px-4 py-2.5">
                    <p className="text-sm font-semibold text-navy">{student.fullName}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy/50">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" strokeWidth={2} />
                        {student.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" strokeWidth={2} />
                        {student.phone}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-navy/45">{student.courseLabel}</p>
                    <StudentFeedbackPanel batchId={batch.batchId} student={student} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <RecordingsSection batchId={batch.batchId} recordings={batch.recordings} />
          <MaterialsSection batchId={batch.batchId} materials={batch.materials} />
          <MessagesSection batchId={batch.batchId} students={batch.students} sentMessages={batch.sentMessages} />
        </div>
      ))}
    </div>
  );
}
