"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Send, User, Wrench } from "lucide-react";

const SUGGESTIONS = [
  "Create a new batch called 'November Batch' at 8:00 PM EST under Foundation Level 2",
  "Rename the TCF Native batch to 'TCF Native — Evening'",
  "Move everyone in the October batch to a new Level 3",
  "What's the attendance and fees due for [student name]?",
  "Show me unanswered student questions",
  "Search enrollments for [name or email]",
];

function ToolCallBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-cream-dim px-2.5 py-1 text-[11px] font-semibold text-navy/60">
      <Wrench className="h-3 w-3" strokeWidth={2} />
      {name}
    </span>
  );
}

export default function AdminAiChat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: "/api/admin/ai" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(input);
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] flex-col rounded-2xl border border-navy/10 bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-navy/60">
              Tell it what to do — create or edit a batch, swap a finished batch&apos;s students onto
              a new one, or ask about a student&apos;s course, attendance, or fees due.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border border-navy/15 bg-cream-dim/60 px-3 py-1.5 text-xs text-navy/70 hover:border-red/30 hover:text-red-dark"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  message.role === "user" ? "bg-navy text-cream" : "bg-red-soft text-red-dark"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Bot className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </span>
              <div className={`max-w-[80%] space-y-1.5 ${message.role === "user" ? "items-end" : ""}`}>
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p
                        key={i}
                        className={`whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          message.role === "user"
                            ? "bg-navy text-cream"
                            : "bg-cream-dim text-navy shadow-sm shadow-navy/5"
                        }`}
                      >
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    return <ToolCallBadge key={i} name={part.type.replace("tool-", "")} />;
                  }
                  return null;
                })}
              </div>
            </div>
          ))
        )}
        {isBusy ? <p className="text-xs text-navy/40">Working…</p> : null}
        {error ? (
          <div className="rounded-xl bg-red-soft px-3.5 py-2.5 text-sm text-navy">
            <p>Something went wrong on that request.</p>
            <button
              type="button"
              onClick={() => regenerate()}
              className="mt-1 font-semibold text-red underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-navy/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="e.g. Move the October batch's students to a new Level 2…"
          className="flex-1 rounded-full border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none focus:border-red/50"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red text-white transition hover:bg-red-dark disabled:opacity-40"
        >
          <Send className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
