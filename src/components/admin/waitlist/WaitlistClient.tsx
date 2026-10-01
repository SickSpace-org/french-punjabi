"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Send, Trash2 } from "lucide-react";
import { emailWaitlistNow, removeWaitlistEntry } from "@/app/admin/(dashboard)/waitlist/actions";
import type { AdminWaitlistBatch, AdminWaitlistEntry } from "@/lib/waitlist/getAdminWaitlist";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/ToastProvider";

type Filter = "waiting" | "all";

const DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" });

function formatDate(iso: string) {
  return DATE_FORMAT.format(new Date(iso));
}

function EntryRow({ entry, onRemove }: { entry: AdminWaitlistEntry; onRemove: () => void }) {
  return (
    <tr className="border-b border-navy/5 align-top last:border-0">
      <td className="px-3 py-3 font-semibold text-navy">{entry.fullName}</td>
      <td className="px-2 py-3">
        <a href={`mailto:${entry.email}`} className="flex items-center gap-1.5 text-navy/70 hover:text-red">
          <Mail className="h-3.5 w-3.5 shrink-0 text-navy/40" strokeWidth={2} />
          {entry.email}
        </a>
        <a href={`tel:${entry.phone}`} className="mt-1 flex items-center gap-1.5 text-navy/70 hover:text-red">
          <Phone className="h-3.5 w-3.5 shrink-0 text-navy/40" strokeWidth={2} />
          {entry.phone}
        </a>
      </td>
      <td className="max-w-[260px] px-2 py-3 text-navy/60">{entry.message ?? "—"}</td>
      <td className="whitespace-nowrap px-2 py-3 text-navy/60">{formatDate(entry.createdAt)}</td>
      <td className="whitespace-nowrap px-2 py-3">
        {entry.notifiedAt ? (
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
            Emailed {formatDate(entry.notifiedAt)}
          </span>
        ) : (
          <span className="rounded-full bg-red-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-dark">
            Waiting
          </span>
        )}
      </td>
      <td className="px-2 py-3 text-right">
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${entry.fullName} from the waitlist`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-navy/40 transition-colors hover:bg-red-soft hover:text-red"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </button>
      </td>
    </tr>
  );
}

type PendingAction =
  | { kind: "email"; batch: AdminWaitlistBatch; waiting: number }
  | { kind: "remove"; entry: AdminWaitlistEntry };

export default function WaitlistClient({ batches }: { batches: AdminWaitlistBatch[] }) {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>("waiting");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalWaiting = batches.reduce((n, b) => n + b.entries.filter((e) => !e.notifiedAt).length, 0);
  const visible = batches
    .map((b) => ({ ...b, entries: filter === "waiting" ? b.entries.filter((e) => !e.notifiedAt) : b.entries }))
    .filter((b) => b.entries.length > 0);

  const confirm = () => {
    if (!pendingAction) return;
    startTransition(async () => {
      const result =
        pendingAction.kind === "email"
          ? await emailWaitlistNow(pendingAction.batch.batchId)
          : await removeWaitlistEntry(pendingAction.entry.id);
      if (result.ok) {
        showToast(result.message ?? "Removed from the waitlist.");
      } else {
        showToast(result.error, "error");
      }
      setPendingAction(null);
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-navy/60">
          <span className="font-display text-2xl font-bold text-navy">{totalWaiting}</span> waiting across{" "}
          {batches.filter((b) => b.entries.some((e) => !e.notifiedAt)).length} batches
        </p>
        <div role="group" aria-label="Filter" className="inline-flex rounded-full border border-navy/15 bg-white p-1">
          {(["waiting", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                filter === value ? "bg-navy text-white" : "text-navy/60 hover:text-navy"
              }`}
            >
              {value === "waiting" ? "Still waiting" : "Everyone"}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-12 text-center text-sm text-navy/60">
          Everyone on the waitlist has already been emailed. Switch to &ldquo;Everyone&rdquo; to see them.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {visible.map((batch) => {
            const waiting = batch.entries.filter((e) => !e.notifiedAt).length;
            return (
              <section key={batch.batchId} className="overflow-hidden rounded-2xl border border-navy/10 bg-white">
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-navy/10 bg-cream-dim/50 px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-navy">{batch.courseName}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-navy/60">
                      {batch.batchTiming}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          batch.hasOpenSeat ? "bg-green-50 text-green-700" : "bg-navy/10 text-navy/60"
                        }`}
                      >
                        {batch.seatLabel}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={waiting === 0}
                    onClick={() => setPendingAction({ kind: "email", batch, waiting })}
                    className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-navy-dark disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Email {waiting} waiting
                  </button>
                </header>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-navy/10 text-[10px] font-bold uppercase tracking-wide text-navy/40">
                        <th className="px-3 py-2">Student</th>
                        <th className="px-2 py-2">Contact</th>
                        <th className="px-2 py-2">Message</th>
                        <th className="px-2 py-2">Joined</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {batch.entries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          onRemove={() => setPendingAction({ kind: "remove", entry })}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={
          pendingAction?.kind === "email"
            ? `Email ${pendingAction.waiting} waiting student${pendingAction.waiting === 1 ? "" : "s"}?`
            : "Remove from waitlist?"
        }
        description={
          pendingAction?.kind === "email"
            ? `They'll get the "a seat just opened up" email with a link to enroll in ${pendingAction.batch.courseName}.${
                pendingAction.batch.hasOpenSeat ? "" : " This batch is still marked full."
              }`
            : pendingAction?.kind === "remove"
              ? `${pendingAction.entry.fullName} won't be emailed when a seat opens. This can't be undone.`
              : ""
        }
        confirmLabel={pendingAction?.kind === "email" ? "Send emails" : "Remove"}
        danger={pendingAction?.kind === "remove"}
        pending={isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={confirm}
      />
    </>
  );
}
