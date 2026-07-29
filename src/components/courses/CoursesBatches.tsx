"use client";

import { useState } from "react";
import { COURSES } from "@/data/courses";
import Reveal from "@/components/Reveal";
import PhaseStepper from "./PhaseStepper";
import PhasePanel from "./PhasePanel";
import CompleteProgramStrip from "./CompleteProgramStrip";
import MonthlyRedoNote from "./MonthlyRedoNote";
import EnrollModal, { type EnrollSelection } from "./EnrollModal";

/** Purely presentational alternation — not tied to course data. */
const PHASE_BG = ["bg-red-soft/40", "bg-cream", "bg-gradient-to-b from-cream-dim to-red-soft/30"];

export default function CoursesBatches() {
  const [selection, setSelection] = useState<EnrollSelection | null>(null);

  return (
    <>
      <section id="batches" className="relative overflow-hidden bg-white py-20 lg:py-24">
        <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-dark">
              Courses
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold uppercase tracking-tight text-navy sm:text-4xl">
              Choose Your Phase
            </h2>
            <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-red" />
            <p className="mt-4 text-base text-navy/60">
              Everything you need — levels, timings, duration and fees — in one place.
            </p>
          </Reveal>

          <Reveal delayMs={100} className="mt-10">
            <PhaseStepper />
          </Reveal>

          <div className="mt-10">
            <CompleteProgramStrip onEnroll={setSelection} />
          </div>
        </div>
      </section>

      {COURSES.map((phase, index) => (
        <section
          key={phase.id}
          className={`relative overflow-hidden py-14 lg:py-16 ${PHASE_BG[index % PHASE_BG.length]}`}
        >
          {index !== 1 ? (
            <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-red/5 blur-3xl" />
          ) : null}
          <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
            <PhasePanel phase={phase} onEnroll={setSelection} />
          </div>
        </section>
      ))}

      <section className="bg-cream-dim py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <MonthlyRedoNote onEnroll={setSelection} />
        </div>
      </section>

      <EnrollModal selection={selection} onClose={() => setSelection(null)} />
    </>
  );
}
