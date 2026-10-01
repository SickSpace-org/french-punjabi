"use client";

import { useMemo, useState, useTransition } from "react";
import { Megaphone, Send } from "lucide-react";
import type { AdminMessageBatchOption, AdminMessageStudentOption, AdminSentMessage } from "@/lib/admin/getAdminMessagesData";
import { sendAdminMessage } from "@/app/admin/(dashboard)/messages/actions";
import { useToast } from "@/components/admin/ToastProvider";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminMessagesClient({
  batches,
  students,
  sentMessages,
}: {
  batches: AdminMessageBatchOption[];
  students: AdminMessageStudentOption[];
  sentMessages: AdminSentMessage[];
}) {
  const { showToast } = useToast();
  const [batchId, setBatchId] = useState<string>(batches[0]?.batchId ?? "");
  const [recipient, setRecipient] = useState<string>("batch");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const studentsInBatch = useMemo(
    () => students.filter((s) => s.currentBatchId === batchId).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [students, batchId]
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !body.trim()) return;
    startTransition(async () => {
      const studentId = recipient === "batch" ? null : recipient;
      const result = await sendAdminMessage(batchId, studentId, body);
      if (result.ok) {
        setBody("");
        showToast("Message sent.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-navy/10 bg-white p-5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-navy/40">
          <Megaphone className="h-3.5 w-3.5" strokeWidth={2} />
          New Message
        </p>

        {batches.length === 0 ? (
          <p className="mt-3 text-sm text-navy/50">No active batches to message yet.</p>
        ) : (
          <form onSubmit={handleSend} className="mt-3 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Batch</label>
                <select
                  value={batchId}
                  onChange={(e) => {
                    setBatchId(e.target.value);
                    setRecipient("batch");
                  }}
                  className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
                >
                  {batches.map((b) => (
                    <option key={b.batchId} value={b.batchId}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 flex-1">
                <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">To</label>
                <select
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
                >
                  <option value="batch">
                    Whole batch ({studentsInBatch.length} student{studentsInBatch.length === 1 ? "" : "s"})
                  </option>
                  {studentsInBatch.map((s) => (
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
              rows={3}
              placeholder="Write an announcement or message…"
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
        )}
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Sent Messages</p>

        {sentMessages.length === 0 ? (
          <p className="mt-3 text-sm text-navy/50">No messages sent yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {sentMessages.map((m) => {
              const readCount = m.recipients.filter((r) => r.isRead).length;
              const to = m.recipients.length === 1 ? m.recipients[0].fullName : `${m.recipients.length} students (${readCount} read)`;
              return (
                <div key={m.broadcastId} className="rounded-xl border border-navy/10 px-4 py-2.5">
                  <p className="text-sm text-navy">{m.body}</p>
                  <p className="mt-1 text-xs text-navy/45">
                    {m.batchLabel} · To: {to} · {formatDateTime(m.createdAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
