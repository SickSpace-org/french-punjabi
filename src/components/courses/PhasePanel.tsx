"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BellRing, Check, Clock, User } from "lucide-react";
import type { Batch, Phase } from "@/lib/courses/types";
import type { EnrollSelection } from "./EnrollModal";
import type { WaitlistSelection } from "./WaitlistModal";
import { DEEP_LINK_SELECT_EVENT, type DeepLinkSelectDetail } from "./deepLinkEvent";
import Reveal from "@/components/Reveal";

type PhasePanelProps = {
  phase: Phase;
  onEnroll: (selection: EnrollSelection) => void;
  /** A full timing was clicked — offer "notify me when a seat opens". */
  onWaitlist: (selection: WaitlistSelection) => void;
};

type Selected = { batchId: string; timingId: string } | null;
type PaymentMode = "full" | "monthly";

/**
 * `cardTitle` is the enclosing card's own title — a Level card pools
 * several batches together under a Level name (e.g. "Level 1"), so each
 * timing's own batch name is new information worth showing. A
 * single-batch direct-batch card's title already IS that batch's name, so
 * showing it again in the one pill would just be redundant — hence only
 * showing it when it actually differs from the card title, rather than
 * just checking how many timings the card has (a Level can currently have
 * only one active batch in it and still need its name shown).
 */
function formatTiming(timing: Batch["timings"][number], cardTitle: string) {
  const base = timing.name && timing.name !== cardTitle ? `${timing.name} — ${timing.label}` : timing.label;
  if (timing.tbd) return `${base} — To Be Confirmed`;
  if (timing.note) return `${base} — ${timing.note}`;
  return base;
}

function TimingRow({
  timing,
  batchTitle,
  isSelected,
  showWarning,
  onSelect,
  onWaitlist,
}: {
  timing: Batch["timings"][number];
  batchTitle: string;
  isSelected: boolean;
  showWarning: boolean;
  onSelect: () => void;
  onWaitlist: () => void;
}) {
  const isFull = timing.status === "full" || timing.seatsLeft === 0;
  const isAlmostFull = timing.status === "almost_full";
  const label = formatTiming(timing, batchTitle);

  return (
    <li>
      <button
        type="button"
        role={isFull ? undefined : "radio"}
        aria-checked={isFull ? undefined : isSelected}
        aria-label={isFull ? `${label} is full. Get notified when a seat opens` : undefined}
        onClick={isFull ? onWaitlist : onSelect}
        className={`group/row flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 ${
          isFull
            ? "border-dashed border-navy/15 bg-transparent text-navy/45 hover:border-navy/30 hover:text-navy/70"
            : isSelected
              ? "border-navy bg-navy text-white shadow-lg shadow-navy/20"
              : `border-navy/10 bg-cream/60 text-navy hover:-translate-y-0.5 hover:border-navy/25 hover:bg-white hover:shadow-md ${
                  showWarning ? "border-red/50 ring-2 ring-red/15" : ""
                }`
        }`}
      >
        <Clock className={`h-4 w-4 shrink-0 ${isSelected ? "text-white/70" : "text-navy/35"}`} strokeWidth={2} />
        <span className="min-w-0 flex-1 font-medium">{label}</span>

        {isFull ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy/5 px-2.5 py-1 text-xs font-semibold text-navy/55 transition-colors group-hover/row:bg-red group-hover/row:text-white">
            <BellRing className="h-3 w-3" strokeWidth={2.5} />
            Full · Notify me
          </span>
        ) : typeof timing.seatsLeft === "number" ? (
          <span className={`shrink-0 text-xs font-semibold ${isSelected ? "text-white/75" : "text-red"}`}>
            {timing.seatsLeft} {timing.seatsLeft === 1 ? "seat" : "seats"} left
          </span>
        ) : isAlmostFull ? (
          <span className={`shrink-0 text-xs font-semibold ${isSelected ? "text-white/75" : "text-red"}`}>Almost full</span>
        ) : null}

        {!isFull ? (
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
              isSelected ? "border-white bg-white text-navy" : "border-navy/20 group-hover/row:border-navy/40"
            }`}
          >
            {isSelected ? <Check className="h-3 w-3" strokeWidth={3.5} /> : null}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export default function PhasePanel({ phase, onEnroll, onWaitlist }: PhasePanelProps) {
  const [selected, setSelected] = useState<Selected>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("full");

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DeepLinkSelectDetail>).detail;
      if (detail?.phaseId !== phase.id) return;
      setSelected({ batchId: detail.batchId, timingId: detail.timingId });
      setShowWarning(false);
    };
    window.addEventListener(DEEP_LINK_SELECT_EVENT, handler);
    return () => window.removeEventListener(DEEP_LINK_SELECT_EVENT, handler);
  }, [phase.id]);

  const isMonthly = paymentMode === "monthly";
  const activePricing = isMonthly ? phase.pricing.monthly : phase.pricing.full;
  const priceBase = activePricing.base;

  const selectedBatch = phase.batches.find((b) => b.id === selected?.batchId);
  const selectedTiming = selectedBatch?.timings.find((t) => t.id === selected?.timingId);

  const handleEnroll = () => {
    if (!selectedBatch || !selectedTiming) {
      setShowWarning(true);
      document.getElementById(phase.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    onEnroll({
      phase: phase.number,
      batch: selectedBatch.title,
      timing: formatTiming(selectedTiming, selectedBatch.title),
      teacher: selectedBatch.teacher,
      paymentMode: isMonthly ? "Monthly" : "Full Phase",
      paymentModeValue: paymentMode,
      feeLabel: isMonthly ? `$${priceBase} / month` : `$${priceBase}`,
      batchId: selectedTiming.id,
    });
  };

  return (
    <div id={phase.id} className="grid scroll-mt-28 gap-6 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-8">
      {/* Step 1: timings */}
      <div>
        <p className="flex items-center gap-3 text-sm font-semibold text-navy">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy font-display text-white">1</span>
          Choose your class timing
        </p>

        <div className="mt-5 space-y-5">
          {phase.batches.map((batch, index) => (
            <Reveal key={batch.id} delayMs={index * 80}>
              <div id={batch.id} className="scroll-mt-28 rounded-3xl border border-navy/10 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h4 className="font-display text-xl font-semibold tracking-tight text-navy">{batch.title}</h4>
                  {batch.teacher ? (
                    <p className="flex items-center gap-1.5 text-sm text-navy/55">
                      <User className="h-3.5 w-3.5 text-navy/35" strokeWidth={2} />
                      with <span className="font-semibold text-navy/80">{batch.teacher}</span>
                    </p>
                  ) : null}
                </div>

                <ul role="radiogroup" aria-label={`${batch.title} timings`} className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {batch.timings.map((timing) => (
                    <TimingRow
                      key={timing.id}
                      timing={timing}
                      batchTitle={batch.title}
                      isSelected={selected?.batchId === batch.id && selected.timingId === timing.id}
                      showWarning={showWarning}
                      onSelect={() => {
                        setSelected({ batchId: batch.id, timingId: timing.id });
                        setShowWarning(false);
                      }}
                      onWaitlist={() =>
                        onWaitlist({
                          batchId: timing.id,
                          phase: phase.title,
                          batch: batch.title,
                          timing: formatTiming(timing, batch.title),
                        })
                      }
                    />
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Step 2: payment + enroll */}
      <aside className="lg:sticky lg:top-28">
        <p className="flex items-center gap-3 text-sm font-semibold text-navy">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy font-display text-white">2</span>
          Choose how to pay
        </p>

        <div className="relative mt-5 overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-2xl shadow-navy/25 sm:p-7">
          <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-red/35 blur-3xl" />

          <div className="relative">
            <p className="text-sm text-white/55">{phase.number} · {phase.months}</p>
            <p className="font-display text-xl font-semibold">{phase.title}</p>

            <div role="group" aria-label="Payment option" className="mt-5 grid grid-cols-2 rounded-full bg-white/10 p-1 ring-1 ring-white/15">
              {(["full", "monthly"] as PaymentMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  aria-pressed={paymentMode === mode}
                  className={`rounded-full py-2 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                    paymentMode === mode ? "bg-white text-navy shadow" : "text-white/70 hover:text-white"
                  }`}
                >
                  {mode === "full" ? "Full phase" : "Monthly"}
                </button>
              ))}
            </div>

            <p key={paymentMode} className="program-rise mt-6 flex items-baseline gap-1.5">
              <span className="font-display text-5xl font-semibold tracking-tight">${priceBase}</span>
              <span className="text-white/55">{isMonthly ? "/ month" : "for the full phase"}</span>
            </p>
            <p className="mt-1.5 text-sm text-white/55">
              {isMonthly
                ? "Pay one month at a time."
                : activePricing.duration
                  ? `${activePricing.duration}, paid once.`
                  : "Paid once for the complete phase."}
            </p>

            <div className="mt-6 rounded-2xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-white/10">
              <p className="text-xs text-white/50">Your timing</p>
              {selectedBatch && selectedTiming ? (
                <p key={selectedTiming.id} className="program-rise mt-0.5 text-sm font-semibold">
                  {selectedBatch.title} · {formatTiming(selectedTiming, selectedBatch.title)}
                </p>
              ) : (
                <p className={`mt-0.5 text-sm ${showWarning ? "font-semibold text-[#9db8ff]" : "text-white/70"}`}>
                  {showWarning ? "Pick a timing first." : "Not picked yet"}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleEnroll}
              className="group/btn mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:bg-red hover:text-white hover:shadow-lg hover:shadow-black/30"
            >
              {isMonthly ? "Enroll, pay monthly" : `Enroll in ${phase.number}`}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
