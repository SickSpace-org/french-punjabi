"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import type { StudentComment } from "@/lib/student/getComments";
import CommentForm from "./CommentForm";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function CommentThread({
  lessonId,
  initialComments,
}: {
  lessonId: string;
  initialComments: StudentComment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Questions &amp; Comments</p>

      <div className="mt-3">
        <CommentForm
          lessonId={lessonId}
          placeholder="Ask a question about this lesson…"
          submitLabel="Ask"
          onPosted={(body) =>
            setComments((prev) => [
              {
                id: `pending-${Date.now()}`,
                body,
                createdAt: new Date().toISOString(),
                authorLabel: "You",
                isOwn: true,
                replies: [],
              },
              ...prev,
            ])
          }
        />
      </div>

      {comments.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-navy/15 py-8 text-center text-navy/40">
          <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
          <p className="text-sm">No questions yet — be the first to ask.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-navy/10 bg-cream-dim/40 p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-navy">
                  {comment.isOwn ? "You" : comment.authorLabel}
                </p>
                <p className="text-[11px] text-navy/40">{formatDate(comment.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-navy/80">{comment.body}</p>

              {comment.replies.length > 0 ? (
                <div className="mt-3 space-y-3 border-l-2 border-navy/10 pl-4">
                  {comment.replies.map((reply) => (
                    <div key={reply.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-navy">
                          {reply.isOwn ? "You" : reply.authorLabel}
                        </span>
                        {reply.isTeacher ? (
                          <span className="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Teacher
                          </span>
                        ) : null}
                        <span className="text-[11px] text-navy/40">{formatDate(reply.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-navy/70">{reply.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {replyingTo === comment.id ? (
                <div className="mt-3">
                  <CommentForm
                    lessonId={lessonId}
                    parentCommentId={comment.id}
                    placeholder="Write a reply…"
                    submitLabel="Reply"
                    autoFocus
                    onPosted={(body) => {
                      setComments((prev) =>
                        prev.map((c) =>
                          c.id === comment.id
                            ? {
                                ...c,
                                replies: [
                                  ...c.replies,
                                  {
                                    id: `pending-${Date.now()}`,
                                    body,
                                    createdAt: new Date().toISOString(),
                                    authorLabel: "You",
                                    isTeacher: false,
                                    isOwn: true,
                                  },
                                ],
                              }
                            : c
                        )
                      );
                      setReplyingTo(null);
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setReplyingTo(comment.id)}
                  className="mt-3 text-xs font-semibold text-navy/50 hover:text-red-dark"
                >
                  Reply
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
