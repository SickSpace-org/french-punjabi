"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { StudentFeedbackThread } from "@/lib/student/getFeedbackNotes";
import { replyToFeedbackNote } from "@/app/student/actions";
import { useToast } from "@/components/admin/ToastProvider";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function ReplyForm({ noteId }: { noteId: string }) {
  const { showToast } = useToast();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await replyToFeedbackNote(noteId, body);
      if (result.ok) {
        setBody("");
        showToast("Reply sent.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-end gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={1}
        placeholder="Write a reply…"
        className="min-w-0 flex-1 rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
      />
      <button
        type="submit"
        disabled={pending || !body.trim()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-navy/15 bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" strokeWidth={2} />
        {pending ? "Sending…" : "Reply"}
      </button>
    </form>
  );
}

/**
 * Private notes a teacher has written about this student, with any
 * replies — never shared with classmates (contrast with the shared
 * lesson-comments Q&A elsewhere in the portal). A student can reply, but
 * never start a new thread (see supabase/037_student_feedback_notes.sql).
 * Kept as its own clearly-labeled card, deliberately not interleaved
 * with ClassRecordingsList/BatchMaterialsList below it on this same
 * dashboard, so the two stay visually distinct.
 */
export default function StudentFeedbackCard({ threads }: { threads: StudentFeedbackThread[] }) {
  if (threads.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
      <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-dark">
        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
        Feedback From Your Teacher
      </p>
      <div className="mt-3 space-y-3">
        {threads.map((thread) => (
          <div key={thread.noteId} className="rounded-xl border border-navy/10 px-4 py-3">
            <p className="text-sm text-navy">{thread.body}</p>
            <p className="mt-1 text-xs text-navy/45">
              {thread.teacherName} · {formatDateTime(thread.createdAt)}
            </p>

            {thread.replies.length > 0 ? (
              <div className="mt-2 space-y-1.5 border-t border-navy/10 pt-2">
                {thread.replies.map((reply) => (
                  <div key={reply.id} className="rounded-lg bg-cream-dim/50 px-3 py-2">
                    <p className="text-xs text-navy">{reply.body}</p>
                    <p className="mt-0.5 text-[10px] text-navy/40">You · {formatDateTime(reply.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <ReplyForm noteId={thread.noteId} />
          </div>
        ))}
      </div>
    </div>
  );
}
