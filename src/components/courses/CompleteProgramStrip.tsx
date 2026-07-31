"use client";

import { ArrowRight, Medal } from "lucide-react";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";
import type { ProgramOffer } from "@/lib/courses/types";
import type { EnrollSelection } from "./EnrollModal";

type CompleteProgramStripProps = {
  offer: ProgramOffer;
  onEnroll: (selection: EnrollSelection) => void;
};

export default function CompleteProgramStrip({ offer, onEnroll }: CompleteProgramStripProps) {
  const handleEnroll = () => {
    onEnroll({
      phase: "Complete Program",
      batch: `${offer.duration} Journey — Phase 1 → Phase 2 → Phase 3`,
      timing: "Batch timings confirmed after enrollment",
      feeLabel: `$${offer.base} + Tax`,
      programOfferKey: "complete_program",
    });
  };

  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-dark via-navy to-navy-dark px-6 py-8 shadow-xl shadow-navy/20 sm:px-10 sm:py-9">
        <div className="bg-hairlines pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red/20 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red/20 text-white">
              <Medal className="h-6 w-6" strokeWidth={2} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-red-soft/90">
                Complete {offer.duration} Program
              </p>
              <p className="mt-1 font-display text-lg font-bold text-white sm:text-xl">
                Phase 1 → Phase 2 → Phase 3
              </p>
              <p className="mt-1 text-sm text-white/70">
                <span className="font-semibold text-white">${offer.base}</span> + Tax
                {offer.total != null ? (
                  <>
                    {" "}
                    · Total{" "}
                    <CountUp
                      end={offer.total}
                      decimals={2}
                      prefix="$"
                      className="font-semibold text-white"
                    />
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnroll}
            className="group/btn inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-navy-dark shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          >
            Enroll for Complete Program
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
              strokeWidth={2.5}
            />
          </button>
        </div>
      </div>
    </Reveal>
  );
}
