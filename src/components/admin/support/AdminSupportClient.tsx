"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, MessageCircleQuestion, RotateCcw, Send } from "lucide-react";
import type { AdminTicket } from "@/lib/admin/getAdminSupportTickets";
import { adminReplyToTicket, markTicketMessagesRead, setTicketStatus } from "@/app/admin/(dashboard)/support/actions";
import { useToast } from "@/components/admin/ToastProvider";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
] as const;

function TicketCard({ ticket }: { ticket: AdminTicket }) {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const unreadFromStudent = ticket.messages.filter((m) => m.senderType === "student" && !m.isRead).length;

  const handleExpand = () => {
    setExpanded((v) => !v);
    if (!expanded && unreadFromStudent > 0) void markTicketMessagesRead(ticket.id);
  };

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await adminReplyToTicket(ticket.id, { email: ticket.studentEmail, fullName: ticket.studentName }, ticket.subject, body);
      if (result.ok) {
        setBody("");
        showToast("Reply sent.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  const handleToggleStatus = () => {
    const next = ticket.status === "OPEN" ? "RESOLVED" : "OPEN";
    startTransition(async () => {
      const result = await setTicketStatus(ticket.id, next);
      if (!result.ok) showToast(result.error, "error");
    });
  };

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <button type="button" onClick={handleExpand} className="flex w-full flex-wrap items-start justify-between gap-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-navy">{ticket.subject}</p>
          <p className="text-xs text-navy/50">
            {ticket.studentName} · {ticket.studentEmail}
          </p>
          <p className="mt-1 text-[11px] text-navy/40">Last activity {formatDateTime(ticket.updatedAt)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unreadFromStudent > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1.5 text-[11px] font-bold text-white">
              {unreadFromStudent}
            </span>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
              ticket.status === "OPEN" ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {ticket.status === "OPEN" ? "Open" : "Resolved"}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-navy/40" strokeWidth={2} /> : <ChevronDown className="h-4 w-4 text-navy/40" strokeWidth={2} />}
        </div>
      </button>

      {expanded ? (
        <div className="mt-4 border-t border-navy/10 pt-4">
          <div className="space-y-2">
            {ticket.messages.map((m) => (
              <div key={m.id} className={`rounded-xl px-3.5 py-2.5 ${m.senderType === "admin" ? "bg-navy/5" : "bg-cream-dim/70"}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-navy/40">{m.senderType === "admin" ? "Admin" : ticket.studentName}</p>
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

          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={pending}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-navy/60 hover:text-navy disabled:opacity-50"
          >
            {ticket.status === "OPEN" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Mark Resolved
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                Reopen
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminSupportClient({ tickets }: { tickets: AdminTicket[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("open");

  const openCount = tickets.filter((t) => t.status === "OPEN").length;

  const filtered = useMemo(() => {
    if (filter === "open") return tickets.filter((t) => t.status === "OPEN");
    if (filter === "resolved") return tickets.filter((t) => t.status === "RESOLVED");
    return tickets;
  }, [tickets, filter]);

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:w-64">
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">Open</p>
          <p className="mt-1 font-display text-2xl font-bold text-navy">{openCount}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              filter === f.value ? "border-red bg-red text-white" : "border-navy/15 bg-white text-navy/70 hover:border-red/30 hover:text-red"
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
          <p className="mt-4 text-sm font-medium text-navy/60">{tickets.length === 0 ? "No tickets yet." : "Nothing matches this filter."}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
