"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import type { AdminComment } from "@/lib/comments/getAdminComments";
import { replyToComment } from "@/app/admin/(dashboard)/comments/actions";
import { useToast } from "@/components/admin/ToastProvider";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ReplyModal({
  comment,
  onClose,
  onReplied,
}: {
  comment: AdminComment;
  onClose: () => void;
  onReplied: (commentId: string, reply: AdminComment["replies"][number]) => void;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await replyToComment(comment.id, body.trim());
      if (result.ok) {
        onReplied(comment.id, {
          id: `${comment.id}-pending-${Date.now()}`,
          body: body.trim(),
          createdAt: new Date().toISOString(),
          authorLabel: "Teacher",
          isTeacher: true,
        });
        showToast("Reply sent.");
        onClose();
      } else {
        showToast(result.error || "Unable to send reply. Please try again.", "error");
      }
    });
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
          <div>
            <p className="font-display text-lg font-bold text-navy">{comment.studentName}</p>
            <p className="text-xs text-navy/50">
              {comment.phaseTitle} · {comment.weekTitle} · {comment.lessonTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-navy/50 hover:bg-cream-dim hover:text-navy"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border-l-4 border-red bg-red-soft/40 p-4">
          <p className="text-sm text-navy">{comment.body}</p>
          <p className="mt-1.5 text-[11px] text-navy/40">{formatDate(comment.createdAt)}</p>
        </div>

        {comment.replies.length > 0 ? (
          <div className="mt-4 space-y-3 border-t border-navy/10 pt-4">
            {comment.replies.map((reply) => (
              <div key={reply.id} className="pl-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-navy">{reply.authorLabel}</span>
                  {reply.isTeacher ? (
                    <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Teacher
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-navy/70">{reply.body}</p>
                <p className="mt-0.5 text-[11px] text-navy/40">{formatDate(reply.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3 border-t border-navy/10 pt-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
            Your Reply
          </label>
          <textarea
            rows={4}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your reply…"
            className="w-full resize-none rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-navy/15 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream-dim"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-red px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send Reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
