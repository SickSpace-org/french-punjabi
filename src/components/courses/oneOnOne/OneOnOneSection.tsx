"use client";

import { useState } from "react";
import { BellRing, Clock, UserRound } from "lucide-react";
import EnrollModal, { type EnrollSelection } from "../EnrollModal";
import OneOnOneNotifyModal, { type NotifySelection } from "./OneOnOneNotifyModal";
import { ONE_ON_ONE_ANCHOR, PERSONALISED_TITLE } from "@/data/personalisedOneOnOne";
import type { OneOnOneSlot, ProgramOffer } from "@/lib/courses/types";

type OneOnOneSectionProps = {
  /** The real phase this offer sits under. */
  phase: { dbId: string; title: string };
  slots: OneOnOneSlot[];
  offer: ProgramOffer;
  /** Hides the small "Personalised One-on-One" label when a parent already provides that heading. */
  compact?: boolean;
  /** DOM id, so each phase's block can be linked to. Defaults to the shared anchor. */
  anchorId?: string;
};

function money(n: number) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/**
 * One phase's personalised one-on-one block: pick an open time slot, or,
 * when the admin hasn't opened any, ask to be told when the next batch opens.
 */
export default function OneOnOneSection({
  phase,
  slots,
  offer,
  compact = false,
  anchorId = ONE_ON_ONE_ANCHOR,
}: OneOnOneSectionProps) {
  const [selection, setSelection] = useState<EnrollSelection | null>(null);
  const [notify, setNotify] = useState<NotifySelection | null>(null);

  const price = offer.total ?? offer.base;
  const hasOpen = slots.some((s) => s.open);

  const choose = (slot: OneOnOneSlot) =>
    setSelection({
      phase: phase.title,
      batch: PERSONALISED_TITLE,
      timing: slot.label,
      teacher: slot.teacher,
      feeLabel: money(price),
      totalLabel: `${money(price)} / month`,
      paymentMode: "Monthly",
      paymentModeValue: "monthly",
      batchId: slot.id,
      oneOnOne: true,
    });

  return (
    <div id={anchorId} className="scroll-mt-24 rounded-3xl border border-navy/10 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {compact ? null : (
            <p className="flex items-center gap-2 text-sm font-medium text-navy/50">
              <UserRound className="h-4 w-4" strokeWidth={2} />
              {PERSONALISED_TITLE}
            </p>
          )}
          <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight text-navy">{phase.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-navy/60">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            Private batch, just you and your teacher
          </p>
        </div>
        <p className="font-display text-3xl font-semibold text-navy">
          {money(price)}
          <span className="text-base font-normal text-navy/55"> / month</span>
        </p>
      </div>

      {slots.length > 0 ? (
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {slots.map((slot) => (
            <li key={slot.id}>
              <button
                type="button"
                disabled={!slot.open}
                onClick={() => choose(slot)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-all duration-300 ${
                  slot.open
                    ? "border-navy/15 bg-white text-navy hover:-translate-y-0.5 hover:border-red/40 hover:shadow-md"
                    : "cursor-not-allowed border-navy/10 bg-cream-dim/60 text-navy/40"
                }`}
              >
                <span className="font-semibold">{slot.label}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    slot.open ? "bg-red-soft text-red-dark" : "bg-navy/5 text-navy/45"
                  }`}
                >
                  {slot.open ? "Reserve" : "Taken"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hasOpen ? (
        <p className="mt-4 text-xs text-navy/50">
          First come, first served. Your slot is held for you as soon as you submit the form.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-cream-dim/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-navy/70">
            {slots.length > 0
              ? "Every slot for this phase is taken right now."
              : "No one-on-one slots are open for this phase right now."}{" "}
            We&apos;ll email you when the next batch opens.
          </p>
          <button
            type="button"
            onClick={() => setNotify({ phaseId: phase.dbId, phaseTitle: phase.title })}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-navy-dark"
          >
            <BellRing className="h-4 w-4" strokeWidth={2.5} />
            Notify me when it opens
          </button>
        </div>
      )}

      <EnrollModal selection={selection} onClose={() => setSelection(null)} />
      <OneOnOneNotifyModal selection={notify} onClose={() => setNotify(null)} />
    </div>
  );
}
