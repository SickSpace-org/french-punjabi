"use client";

import { useState, useTransition } from "react";
import { postComment } from "@/app/student/actions";
import { useToast } from "@/components/admin/ToastProvider";

export default function CommentForm({
  lessonId,
  parentCommentId,
  placeholder,
  submitLabel,
  onPosted,
  autoFocus,
}: {
  lessonId: string;
  parentCommentId?: string;
  placeholder: string;
  submitLabel: string;
  onPosted: (body: string) => void;
  autoFocus?: boolean;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    const value = body.trim();
    startTransition(async () => {
      const result = await postComment(lessonId, value, parentCommentId);
      if (result.ok) {
        setBody("");
        onPosted(value);
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <textarea
        autoFocus={autoFocus}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        className="w-full flex-1 resize-none rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
      />
      <button
        type="submit"
        disabled={pending || !body.trim()}
        className="shrink-0 rounded-full bg-red px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
      >
        {pending ? "Posting…" : submitLabel}
      </button>
    </form>
  );
}
