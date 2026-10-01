import Link from "next/link";
import { ArrowRight, BookOpen, MessagesSquare, Trophy } from "lucide-react";
import Reveal from "@/components/Reveal";
import { PHASE_META, ROADMAP_PHASE_BANDS } from "@/data/syllabus";

const PHASE_ICONS = [BookOpen, MessagesSquare, Trophy];
const PHASE_LEVELS = ["A1 → A2", "A2 → B1", "B1 → B2+"];

/** Three-phase overview of the program, with a progress rail that draws in on scroll. */
export default function JourneyPreview() {
  return (
    <section id="program" className="relative overflow-hidden bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
              One clear path, three phases, seven months.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-navy/65">
              You always know what you&apos;re learning this month and why. Join at the
              phase that matches your level.
            </p>
          </Reveal>
          <Reveal delayMs={120}>
            <Link
              href="/program"
              className="group inline-flex items-center gap-2 rounded-full border border-navy/15 px-6 py-3 text-sm font-semibold text-navy transition-all hover:-translate-y-0.5 hover:border-navy/30 hover:shadow-md"
            >
              Full month-by-month syllabus
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>

        <Reveal variant="fade" className="journey mt-14">
          {/* Progress rail (desktop) */}
          <div className="relative mb-8 hidden h-1.5 rounded-full bg-navy/8 lg:block">
            <div className="journey-line absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-navy via-red to-blue" />
            {[0, 50, 100].map((left, i) => (
              <span
                key={left}
                className="journey-dot absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-red shadow-md"
                style={{ left: `${left === 0 ? 2 : left === 100 ? 98 : 50}%`, transitionDelay: `${400 + i * 450}ms` }}
              />
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {PHASE_META.map((phase, i) => {
              const Icon = PHASE_ICONS[i];
              const band = ROADMAP_PHASE_BANDS[i];
              return (
                <Reveal key={phase.id} variant="up" delayMs={200 + i * 150} className="h-full">
                  <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-navy/10 bg-cream p-7 transition-all duration-500 hover:-translate-y-1.5 hover:border-red/25 hover:shadow-2xl hover:shadow-navy/10">
                    <span className="pointer-events-none absolute -right-6 -top-10 font-display text-[9rem] font-bold leading-none text-navy/[0.04] transition-colors duration-500 group-hover:text-red/[0.07]">
                      {i + 1}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-white transition-all duration-500 group-hover:rotate-[-6deg] group-hover:bg-red">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-navy/60 ring-1 ring-navy/10">
                        {band.months}
                      </span>
                    </div>
                    <p className="mt-6 text-sm font-semibold text-red">
                      {phase.code} · {PHASE_LEVELS[i]}
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-semibold text-navy">{phase.heading}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-navy/65">{phase.objective}</p>
                    <Link
                      href={`/courses/phase-${i + 1}`}
                      className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-navy transition-colors group-hover:text-red"
                    >
                      Explore phase {i + 1}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
