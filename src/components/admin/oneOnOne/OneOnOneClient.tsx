"use client";

import { useState, useTransition } from "react";
import { BellRing, EyeOff, Mail, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  addOneOnOneSlots,
  deleteOneOnOneSlot,
  emailOneOnOneWaiting,
  removeOneOnOneWaiting,
  reopenOneOnOneSlot,
  setOneOnOneSlotVisible,
} from "@/app/admin/(dashboard)/one-on-one/actions";
import type { AdminOneOnOneData, AdminSlot, SlotState } from "@/lib/oneOnOne/getAdminOneOnOne";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { DAY_LABELS } from "@/lib/attendance/schedule";

const STATE_BADGE: Record<SlotState, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-emerald-50 text-emerald-700" },
  reserved: { label: "Reserved, awaiting payment", className: "bg-amber-50 text-amber-700" },
  taken: { label: "Taken", className: "bg-navy/5 text-navy/70" },
  closed: { label: "Closed", className: "bg-red-soft text-red-dark" },
  hidden: { label: "Hidden", className: "bg-navy/5 text-navy/40" },
};

const INPUT =
  "mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10";

export default function OneOnOneClient({ data }: { data: AdminOneOnOneData }) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [reopening, setReopening] = useState<AdminSlot | null>(null);
  const [deleting, setDeleting] = useState<AdminSlot | null>(null);

  const [phaseId, setPhaseId] = useState(data.phases[0]?.id ?? "");
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("14:00");
  const [timezone, setTimezone] = useState("EST");
  const [teacherId, setTeacherId] = useState(data.defaultTeacherId ?? "");
  const [classDays, setClassDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [meetingLink, setMeetingLink] = useState("");

  const run = (task: () => Promise<{ ok: boolean; message?: string; error?: string }>, success?: string) =>
    startTransition(async () => {
      const result = await task();
      if (result.ok) showToast(result.message ?? success ?? "Saved.");
      else showToast(result.error ?? "Something went wrong. Please try again.", "error");
    });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      addOneOnOneSlots({
        phaseId,
        start,
        end,
        timezone,
        teacherId: teacherId || null,
        classDays,
        meetingLink,
      })
    );
  };

  const toggleDay = (day: number) =>
    setClassDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  return (
    <div className="space-y-10">
      {/* Add slots */}
      <form onSubmit={handleAdd} className="rounded-2xl border border-navy/10 bg-white p-6">
        <p className="font-display text-lg font-bold text-navy">Open slots</p>
        <p className="mt-1 text-sm text-navy/55">
          Creates back-to-back 30-minute slots in the range below. Anyone waiting for this phase is emailed
          automatically.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">Phase</label>
            <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} className={INPUT}>
              {data.phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">From</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">Until</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">Timezone label</label>
            <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">Teacher</label>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={INPUT}>
              <option value="">Hitesh (no teacher account linked)</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">
              Meeting link (optional)
            </label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/…"
              className={INPUT}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-navy/50">Class days</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    classDays.includes(day)
                      ? "border-navy bg-navy text-white"
                      : "border-navy/15 bg-white text-navy/60 hover:border-navy/30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!data.defaultTeacherId ? (
          <p className="mt-4 text-xs text-navy/50">
            No teacher account for Hitesh was found, so slots show &ldquo;Hitesh&rdquo; as the teacher name. Add him
            in Teachers and pick him here to put these slots on his teacher dashboard.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !phaseId}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-red px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-dark disabled:opacity-60"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          {pending ? "Working…" : "Open slots"}
        </button>
      </form>

      {/* Per phase */}
      {data.phases.map((phase) => {
        const waiting = phase.notify.filter((n) => !n.notified_at).length;
        return (
          <section key={phase.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-navy">{phase.title}</h2>
              <p className="text-sm text-navy/50">
                {phase.slots.filter((s) => s.state === "open").length} open of {phase.slots.length} slots
              </p>
            </div>

            {phase.slots.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-8 text-center text-sm text-navy/55">
                No one-on-one slots for this phase yet. Visitors see &ldquo;Notify me when it opens&rdquo;.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-navy/10 overflow-hidden rounded-2xl border border-navy/10 bg-white">
                {phase.slots.map((slot) => {
                  const badge = STATE_BADGE[slot.state];
                  return (
                    <li key={slot.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
                      <div className="min-w-[11rem]">
                        <p className="font-semibold text-navy">
                          {slot.label} <span className="font-normal text-navy/45">{slot.timezone}</span>
                        </p>
                        <p className="text-xs text-navy/50">{slot.teacherName ?? "No teacher"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        {slot.student ? (
                          <>
                            <p className="truncate font-medium text-navy">{slot.student.name}</p>
                            <p className="truncate text-xs text-navy/50">
                              {slot.student.email} · {slot.student.ref} ·{" "}
                              {slot.student.paymentStatus === "PAID" ? "Paid" : "Payment pending"}
                              {slot.student.studentStatus && slot.student.studentStatus !== "ACTIVE"
                                ? ` · Student ${slot.student.studentStatus.toLowerCase()}`
                                : ""}
                            </p>
                          </>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {slot.state === "reserved" || slot.state === "taken" || slot.state === "closed" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setReopening(slot)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 px-3.5 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-red/40 hover:text-red disabled:opacity-60"
                          >
                            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Reopen
                          </button>
                        ) : null}
                        {slot.state === "open" || slot.state === "hidden" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => setOneOnOneSlotVisible(slot.id, slot.state === "hidden"))}
                            className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 px-3.5 py-1.5 text-xs font-semibold text-navy/70 transition-colors hover:border-navy/30 disabled:opacity-60"
                          >
                            <EyeOff className="h-3.5 w-3.5" strokeWidth={2.5} />
                            {slot.state === "hidden" ? "Show" : "Hide"}
                          </button>
                        ) : null}
                        {slot.state === "open" || slot.state === "hidden" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setDeleting(slot)}
                            aria-label={`Delete ${slot.label}`}
                            className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 px-3.5 py-1.5 text-xs font-semibold text-red transition-colors hover:border-red/40 hover:bg-red-soft disabled:opacity-60"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Notify list */}
            <div className="mt-4 rounded-2xl border border-navy/10 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <BellRing className="h-4 w-4 text-navy/50" strokeWidth={2} />
                  Waiting to be notified ({phase.notify.length})
                </p>
                {phase.notify.length > 0 ? (
                  <div className="flex gap-2">
                    {waiting > 0 ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => emailOneOnOneWaiting(phase.id))}
                        className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-60"
                      >
                        <Mail className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Email {waiting} now
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => emailOneOnOneWaiting(phase.id, true))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 px-3.5 py-1.5 text-xs font-semibold text-navy/70 transition-colors hover:border-navy/30 disabled:opacity-60"
                    >
                      Email everyone again
                    </button>
                  </div>
                ) : null}
              </div>

              {phase.notify.length === 0 ? (
                <p className="mt-2 text-sm text-navy/50">Nobody is waiting for this phase.</p>
              ) : (
                <ul className="mt-3 divide-y divide-navy/10">
                  {phase.notify.map((person) => (
                    <li key={person.id} className="flex items-center gap-4 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-navy">{person.full_name}</p>
                        <p className="truncate text-xs text-navy/50">
                          {person.email} · {person.phone}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-navy/45">
                        {person.notified_at ? "Notified" : "Not notified yet"}
                      </span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => removeOneOnOneWaiting(person.id), "Removed.")}
                        aria-label={`Remove ${person.full_name}`}
                        className="rounded-full p-1.5 text-navy/40 transition-colors hover:bg-red-soft hover:text-red disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      })}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this slot?"
        description={
          deleting
            ? `${deleting.label} ${deleting.timezone} will be removed for good. A slot that someone has enrolled in before can't be deleted; hide it instead.`
            : ""
        }
        confirmLabel="Delete slot"
        danger
        pending={pending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const slot = deleting;
          setDeleting(null);
          if (slot) run(() => deleteOneOnOneSlot(slot.id));
        }}
      />

      <ConfirmDialog
        open={reopening !== null}
        title="Reopen this slot?"
        description={
          reopening?.student
            ? reopening.student.paymentStatus === "PAID"
              ? `${reopening.student.name} has paid for this slot. Reopening frees it for someone else but does NOT change their portal access. Deactivate them from Students if they've left.`
              : `${reopening.student.name} hasn't paid yet. Reopening releases the slot and marks their enrollment as not interested.`
            : "This frees the slot so the next person can reserve it."
        }
        confirmLabel="Reopen slot"
        danger
        pending={pending}
        onCancel={() => setReopening(null)}
        onConfirm={() => {
          const slot = reopening;
          setReopening(null);
          if (slot) run(() => reopenOneOnOneSlot(slot.id));
        }}
      />
    </div>
  );
}
