"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, MessageCircleQuestion, Plus, Send } from "lucide-react";
import type { StudentTicket } from "@/lib/student/getSupportTickets";
import { markTicketMessageRead, openSupportTicket, replyToTicket } from "@/app/student/actions";
import { useToast } from "@/components/admin/ToastProvider";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function NewTicketForm() {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    startTransition(async () => {
      const result = await openSupportTicket(subject, body);
      if (result.ok) {
        setSubject("");
        setBody("");
        setOpen(false);
        showToast("Ticket sent — the team will reply here.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        New Ticket
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-navy/10 bg-white p-5">
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Question about my payment"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div className="mt-3">
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Describe what you need help with…"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending || !subject.trim() || !body.trim()}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          {pending ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy/60 hover:bg-cream-dim"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TicketThread({ ticket }: { ticket: StudentTicket }) {
  const { showToast } = useToast();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await replyToTicket(ticket.id, body);
      if (result.ok) {
        setBody("");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-navy">{ticket.subject}</p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            ticket.status === "OPEN" ? "bg-red-soft text-red-dark" : "bg-navy/10 text-navy/60"
          }`}
        >
          {ticket.status === "OPEN" ? "Open" : "Resolved"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-navy/40">Last activity {formatDateTime(ticket.updatedAt)}</p>

      <div className="mt-3 space-y-2">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl px-3.5 py-2.5 ${
              m.senderType === "admin" ? "bg-navy/5" : "bg-cream-dim/70"
            }`}
            onMouseEnter={() => {
              if (m.senderType === "admin" && !m.isRead) void markTicketMessageRead(m.id);
            }}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-navy/40">
              {m.senderType === "admin" ? "Admin" : "You"}
            </p>
            <p className="mt-0.5 text-sm text-navy">{m.body}</p>
            <p className="mt-1 text-[11px] text-navy/35">{formatDateTime(m.createdAt)}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleReply} className="mt-3 flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder={ticket.status === "RESOLVED" ? "Reply to reopen this ticket…" : "Write a reply…"}
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
    </div>
  );
}

export default function SupportTicketsClient({ tickets }: { tickets: StudentTicket[] }) {
  return (
    <div className="space-y-4">
      <NewTicketForm />

      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-12 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <MessageCircleQuestion className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="mt-3 text-sm font-medium text-navy/60">No tickets yet — open one above if you need help.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketThread key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
      {tickets.every((t) => t.status === "RESOLVED") && tickets.length > 0 ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-navy/40">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          All your tickets are resolved.
        </p>
      ) : null}
    </div>
  );
}
