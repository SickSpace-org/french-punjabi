"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock, GraduationCap, User } from "lucide-react";
import type { Batch, Phase } from "@/data/courses";
import { MONTHLY_FEE } from "@/data/fees";
import type { EnrollSelection } from "./EnrollModal";
import { DEEP_LINK_SELECT_EVENT, type DeepLinkSelectDetail } from "./deepLinkEvent";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";

type PhasePanelProps = {
  phase: Phase;
  onEnroll: (selection: EnrollSelection) => void;
};

type Selected = { batchId: string; timingId: string } | null;
type PaymentMode = "full" | "monthly";

const HEADER_STYLES: Record<string, string> = {
  "phase-1": "bg-gradient-to-br from-red-dark via-red to-red-dark",
  "phase-2": "bg-gradient-to-br from-red-dark via-red to-red-dark",
  "phase-3": "bg-gradient-to-br from-red-dark via-red to-red-dark",
};

const BORDER_STYLES: Record<string, string> = {
  "phase-1": "border-red/20 hover:border-red/40",
  "phase-2": "border-red/20 hover:border-red/40",
  "phase-3": "border-red/20 hover:border-red/40",
};

function formatTiming(timing: Batch["timings"][number]) {
  if (timing.tbd) return `${timing.label} — To Be Confirmed`;
  if (timing.note) return `${timing.label} — ${timing.note}`;
  return timing.label;
}

/** Purely presentational — derives a small category chip from the batch
 * title (e.g. "TCF Native" → "TCF") without touching the underlying data. */
function categoryBadge(title: string) {
  const upper = title.toUpperCase();
  if (upper.includes("TCF")) return "TCF";
  if (upper.includes("TEF")) return "TEF";
  if (upper.includes("NATIVE")) return "NATIVE";
  return null;
}

function gridClass(count: number) {
  if (count === 2) return "sm:grid-cols-2 mx-auto max-w-3xl";
  if (count >= 3) return "sm:grid-cols-2 lg:grid-cols-3";
  return "";
}

export default function PhasePanel({ phase, onEnroll }: PhasePanelProps) {
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
  const priceBase = isMonthly ? MONTHLY_FEE.base : phase.pricing.base;
  const priceTotal = isMonthly ? MONTHLY_FEE.total : phase.pricing.total;

  const handleEnroll = () => {
    const batch = phase.batches.find((b) => b.id === selected?.batchId);
    const timing = batch?.timings.find((t) => t.id === selected?.timingId);
    if (!batch || !timing) {
      setShowWarning(true);
      return;
    }
    onEnroll({
      phase: phase.number,
      batch: batch.title,
      timing: formatTiming(timing),
      teacher: batch.teacher,
      paymentMode: isMonthly ? "Monthly" : "Full Phase",
      feeLabel: `$${priceBase} + Tax`,
      totalLabel: isMonthly
        ? `$${priceTotal.toFixed(2)} / month`
        : `$${priceTotal.toFixed(2)} Total`,
    });
  };

  const taxPercent = Math.round(phase.pricing.taxRate * 100);

  return (
    <div
      id={phase.id}
      className={`laminate group scroll-mt-28 overflow-hidden rounded-3xl border shadow-lg shadow-navy/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/15 ${BORDER_STYLES[phase.id]}`}
    >
      {/* Header */}
      <div className={`relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8 ${HEADER_STYLES[phase.id]}`}>
        {phase.id === "phase-3" ? (
          <div className="bg-hairlines pointer-events-none absolute inset-0 opacity-60" />
        ) : null}
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <Reveal variant="left">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/60">
              {phase.code}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
                {phase.title}
              </h3>
              {phase.badge ? (
                <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  {phase.badge}
                </span>
              ) : null}
            </div>
          </Reveal>
          <Reveal variant="right" delayMs={60}>
            <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              {phase.months}
            </span>
          </Reveal>
        </div>
        <Reveal delayMs={100}>
          <p className="relative mt-4 max-w-2xl text-sm leading-relaxed text-white/75">
            {phase.description}
          </p>
        </Reveal>
      </div>

      {/* Levels / batches */}
      <div className="bg-white px-6 py-7 sm:px-8 sm:py-8">
        <div
          className={`grid grid-cols-1 divide-y divide-navy/8 sm:divide-y-0 sm:divide-x sm:divide-navy/8 ${gridClass(phase.batches.length)}`}
        >
          {phase.batches.map((batch, index) => {
            const badge = categoryBadge(batch.title);
            return (
              <div
                key={batch.id}
                id={batch.id}
                className="scroll-mt-28 rounded-2xl pt-6 transition-all duration-500 first:pt-0 sm:px-6 sm:pt-0 sm:first:pl-0 sm:last:pr-0"
              >
              <Reveal
                variant="up"
                delayMs={index * 70}
              >
                {badge ? (
                  <span className="mb-2 inline-flex w-fit items-center rounded-full bg-red-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-dark">
                    {badge}
                  </span>
                ) : null}
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-soft text-red">
                    <GraduationCap className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <h4 className="font-display text-base font-bold uppercase tracking-wide text-red-dark">
                    {batch.title}
                  </h4>
                </div>

                {batch.teacher ? (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-navy/55">
                    <User className="h-3.5 w-3.5 shrink-0 text-navy/40" strokeWidth={2} />
                    <span>
                      Teacher:{" "}
                      <span className="font-semibold text-navy/75">{batch.teacher}</span>
                    </span>
                  </div>
                ) : null}

                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                  Available Times
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {batch.timings.map((timing) => {
                    const isSelected =
                      selected?.batchId === batch.id && selected.timingId === timing.id;
                    return (
                      <button
                        key={timing.id}
                        type="button"
                        onClick={() => {
                          setSelected({ batchId: batch.id, timingId: timing.id });
                          setShowWarning(false);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-300 ${
                          isSelected
                            ? "border-red bg-red text-white shadow-sm shadow-red/30"
                            : `border-navy/15 bg-cream-dim/60 text-navy/70 hover:border-red/40 hover:bg-red-soft/60 hover:text-red-dark ${
                                showWarning ? "animate-pulse border-red/40" : ""
                              }`
                        }`}
                      >
                        <Clock
                          className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-white" : "text-navy/40"}`}
                          strokeWidth={2}
                        />
                        {formatTiming(timing)}
                      </button>
                    );
                  })}
                </div>
              </Reveal>
              </div>
            );
          })}
        </div>
      </div>

      {/* Price + enroll */}
      <div className="border-t border-navy/10 bg-cream-dim/70 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
              {phase.number} Program Fee
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Payment option"
                className="inline-flex rounded-full border border-navy/15 bg-white p-1"
              >
                <button
                  type="button"
                  onClick={() => setPaymentMode("full")}
                  aria-pressed={!isMonthly}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/50 focus-visible:ring-offset-2 ${
                    !isMonthly
                      ? "bg-red-dark text-white shadow-sm"
                      : "text-navy hover:bg-cream-dim"
                  }`}
                >
                  Full Phase
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("monthly")}
                  aria-pressed={isMonthly}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red/50 focus-visible:ring-offset-2 ${
                    isMonthly
                      ? "bg-red-dark text-white shadow-sm"
                      : "text-navy hover:bg-cream-dim"
                  }`}
                >
                  Monthly
                </button>
              </div>
              <p className="text-xs text-navy/50">
                {isMonthly
                  ? "Pay one month at a time."
                  : "Pay for the complete phase together."}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-6 sm:gap-8">
              {!isMonthly ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                    Duration
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-navy">
                    {phase.pricing.duration}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                  {isMonthly ? "Monthly" : "Full Phase"}
                </p>
                <p className="mt-1 font-display text-3xl font-bold text-navy">${priceBase}</p>
                <p className="text-xs font-bold text-red">+ {taxPercent}% Tax</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                  {isMonthly ? "Per Month" : "Total"}
                </p>
                <CountUp
                  end={priceTotal}
                  decimals={2}
                  prefix="$"
                  duration={500}
                  className="mt-1 block font-display text-2xl font-bold text-red-dark"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnroll}
            className="group/btn inline-flex items-center justify-center gap-2 rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-lg"
          >
            {isMonthly ? "Enroll Monthly" : `Enroll in ${phase.number}`}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
              strokeWidth={2.5}
            />
          </button>
        </div>

        {showWarning ? (
          <p className="mt-3 text-xs font-semibold text-red">
            Please select your preferred batch timing.
          </p>
        ) : null}
      </div>
    </div>
  );
}
