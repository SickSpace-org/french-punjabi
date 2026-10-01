"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { phaseNumberOf } from "@/lib/courseNav";
import type { Phase, ProgramOffers } from "@/lib/courses/types";
import { PHASE_DETAILS } from "@/data/phaseDetails";
import { PHASE_1_LEVELS, PHASE_2_LEVELS, PHASE_3_LEVELS } from "@/data/syllabus";
import OfferCards from "./OfferCards";

const LEVEL_COUNT: Record<number, number> = {
  1: PHASE_1_LEVELS.length,
  2: PHASE_2_LEVELS.length,
  3: PHASE_3_LEVELS.length,
};

type CoursesOverviewProps = {
  phases: Phase[];
  programOffers: ProgramOffers;
};

export default function CoursesOverview({ phases, programOffers }: CoursesOverviewProps) {
  return (
    <section className="bg-cream pb-20 lg:pb-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Pick your phase
            </h2>
            <p className="mt-3 max-w-xl text-lg text-navy/65">
              Already know some French? Skip ahead. Each phase has its own batches and fees.
            </p>
          </div>
        </Reveal>

        <ol className="mt-10 space-y-4">
          {phases.map((phase, i) => {
            const n = phaseNumberOf(phase);
            const detail = PHASE_DETAILS[n];
            const monthly = phase.pricing.monthly.base;
            const full = phase.pricing.full.base;
            return (
              <li key={phase.id}>
                <Reveal delayMs={i * 110}>
                  <Link
                    href={`/courses/${phase.id}`}
                    className="group relative grid items-center gap-6 overflow-hidden rounded-[1.75rem] border border-navy/10 bg-white/60 p-6 outline-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-navy/0 hover:bg-white hover:shadow-[0_30px_60px_-30px_rgba(11,28,57,0.35)] focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-4 focus-visible:ring-offset-cream sm:p-8 md:grid-cols-[auto_1fr_auto] md:gap-10"
                  >
                    {/* Accent bar that grows on hover */}
                    <span className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-gradient-to-b from-red to-[#7aa2ff] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100" />

                    <div className="flex items-center gap-5 md:block">
                      <span className="block font-display text-7xl font-semibold leading-none text-transparent transition-colors duration-500 [-webkit-text-stroke:1.5px_rgba(11,28,57,0.25)] group-hover:text-navy group-hover:[-webkit-text-stroke:1.5px_transparent] sm:text-8xl">
                        {n}
                      </span>
                      <span className="rounded-full bg-cream-dim px-3 py-1 text-sm text-navy/65 md:mt-3 md:inline-block">
                        {phase.months}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-display text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
                        {phase.title}
                      </h3>
                      {detail ? <p className="mt-2 max-w-xl leading-relaxed text-navy/65">{detail.tagline}</p> : null}
                      <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                        {detail ? (
                          <>
                            <span className="text-navy/55">{detail.startsFrom}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-navy/30" />
                            <span className="font-semibold text-navy">{detail.finishesAt}</span>
                            <span className="mx-1 text-navy/20">|</span>
                          </>
                        ) : null}
                        <span className="text-navy/55">{LEVEL_COUNT[n] ?? phase.batches.length} levels</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-6 border-t border-navy/10 pt-5 md:flex-col md:items-end md:border-0 md:pt-0">
                      <div className="md:text-right">
                        {monthly ? (
                          <p className="font-display text-3xl font-semibold text-navy">
                            ${monthly}
                            <span className="font-sans text-base font-normal text-navy/50">/month</span>
                          </p>
                        ) : null}
                        {full ? <p className="text-sm text-navy/50">or ${full} for the full phase</p> : null}
                      </div>
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy text-white transition-all duration-500 group-hover:rotate-45 group-hover:bg-red">
                        <span className="sr-only">Open {phase.number}</span>
                        <ArrowUpRight className="h-5 w-5" strokeWidth={2.25} />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ol>

        <OfferCards phases={phases} programOffers={programOffers} />
      </div>
    </section>
  );
}
