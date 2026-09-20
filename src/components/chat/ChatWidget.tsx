"use client";

import { useChat } from "@ai-sdk/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, MessageCircle, Send, X } from "lucide-react";

const KNOW_LEVEL_PROMPT_DELAY_MS = 2500;
const KNOW_LEVEL_STARTER_MESSAGE =
  "I want to know which course/level is right for me. Can you ask me a few questions to figure that out?";

/** Floating study-assistant chat, shown on every public + student page (not admin). */
export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showKnowLevelPrompt, setShowKnowLevelPrompt] = useState(false);
  const { messages, sendMessage, status, error, regenerate } = useChat();

  // Always shown at the start of every visit — closing it only hides it for
  // this visit, it comes back next time the site loads (no "seen" persistence).
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setShowKnowLevelPrompt(true), KNOW_LEVEL_PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open]);

  if (pathname?.startsWith("/admin")) return null;

  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  }

  function dismissKnowLevelPrompt() {
    setShowKnowLevelPrompt(false);
  }

  function startKnowLevelQuiz() {
    setShowKnowLevelPrompt(false);
    setOpen(true);
    sendMessage({ text: KNOW_LEVEL_STARTER_MESSAGE });
  }

  function toggleOpen() {
    setOpen((v) => !v);
    if (showKnowLevelPrompt) dismissKnowLevelPrompt();
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {showKnowLevelPrompt && !open ? (
        <div className="w-64 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-navy/10 bg-white p-4 shadow-xl shadow-navy/15">
          <button
            type="button"
            onClick={dismissKnowLevelPrompt}
            aria-label="Dismiss"
            className="float-right -mr-1 -mt-1 rounded-full p-1 text-navy/40 transition hover:bg-cream-dim hover:text-navy"
          >
            <X size={14} />
          </button>
          <p className="flex items-center gap-1.5 text-sm font-bold text-navy">
            <Compass size={15} className="shrink-0 text-red" />
            Know Your Level
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-navy/60">
            Not sure which phase to start at? Answer a few quick questions and I&apos;ll tell you
            which course fits you best.
          </p>
          <button
            type="button"
            onClick={startKnowLevelQuiz}
            className="mt-3 w-full rounded-full bg-red px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition hover:bg-red-dark"
          >
            Find My Level
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-cream shadow-2xl shadow-navy/20">
          <div className="flex items-center justify-between bg-navy px-4 py-3">
            <p className="font-display text-sm font-semibold text-cream">
              AngrishFrançais Assistant
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 text-cream/80 transition hover:bg-white/10 hover:text-cream"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-navy/60">
                  Ask me anything about French grammar, vocabulary, or the TEF/TCF exams.
                </p>
                <button
                  type="button"
                  onClick={startKnowLevelQuiz}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red/25 bg-red-soft px-3 py-1.5 text-xs font-semibold text-red-dark transition hover:bg-red-soft/70"
                >
                  <Compass size={13} />
                  Know Your Level
                </button>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === "user"
                      ? "ml-auto bg-red text-white"
                      : "bg-white text-navy shadow-sm shadow-navy/5"
                  }`}
                >
                  {message.parts.map((part, i) =>
                    part.type === "text" ? <span key={i}>{part.text}</span> : null
                  )}
                </div>
              ))
            )}
            {isBusy ? <p className="text-xs text-navy/40">Thinking…</p> : null}
            {error ? (
              <div className="rounded-xl bg-red-soft px-3 py-2 text-sm text-navy">
                <p>Sorry, something went wrong answering that. This is usually temporary.</p>
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
              placeholder="Type your question…"
              className="flex-1 rounded-full border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red/50"
            />
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              aria-label="Send message"
              className="rounded-full bg-red p-2 text-white transition disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleOpen}
        aria-label={open ? "Close chat" : "Open chat"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-red text-white shadow-lg shadow-navy/20 transition hover:bg-red-dark"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
