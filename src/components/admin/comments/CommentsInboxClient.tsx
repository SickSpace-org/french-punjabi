"use client";

import { useMemo, useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import type { AdminComment } from "@/lib/comments/getAdminComments";
import ReplyModal from "./ReplyModal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unanswered", label: "Unanswered" },
  { value: "answered", label: "Answered" },
] as const;

export default function CommentsInboxClient({ initialComments }: { initialComments: AdminComment[] }) {
  const [comments, setComments] = useState(initialComments);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [replying, setReplying] = useState<AdminComment | null>(null);

  const unansweredCount = comments.filter((c) => c.replies.length === 0).length;

  const filtered = useMemo(() => {
    if (filter === "unanswered") return comments.filter((c) => c.replies.length === 0);
    if (filter === "answered") return comments.filter((c) => c.replies.length > 0);
    return comments;
  }, [comments, filter]);

  const handleReplied = (commentId: string, reply: AdminComment["replies"][number]) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c))
    );
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:w-64">
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Unanswered
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-navy">{unansweredCount}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              filter === f.value
                ? "border-red bg-red text-white"
                : "border-navy/15 bg-white text-navy/70 hover:border-red/30 hover:text-red"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <MessageCircleQuestion className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">
            {comments.length === 0 ? "No student questions yet." : "Nothing matches this filter."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((comment) => {
            const answered = comment.replies.length > 0;
            return (
              <div
                key={comment.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-navy/10 bg-white p-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-bold text-navy">{comment.studentName}</p>
                  <p className="text-xs text-navy/50">
                    {comment.phaseTitle} · {comment.weekTitle} · {comment.lessonTitle}
                  </p>
                  <p className="mt-2 text-sm text-navy/80">&ldquo;{comment.body}&rdquo;</p>
                  <p className="mt-1.5 text-[11px] text-navy/40">{formatDate(comment.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      answered
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {answered ? "Answered" : "Unanswered"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplying(comment)}
                    className="rounded-full bg-red px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark"
                  >
                    Reply
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {replying ? (
        <ReplyModal
          comment={replying}
          onClose={() => setReplying(null)}
          onReplied={handleReplied}
        />
      ) : null}
    </div>
  );
}
