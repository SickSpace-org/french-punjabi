import Link from "next/link";
import { Flag } from "lucide-react";
import { PHASE_1_LEVELS, PHASE_2_LEVELS } from "@/data/syllabus";

type Stop = { month: string; title: string; href: string };

const PHASES: { name: string; rail: string; dot: string; stops: Stop[] }[] = [
  {
    name: "Phase 1: Foundation",
    rail: "border-white/30",
    dot: "bg-white",
    stops: PHASE_1_LEVELS.map((l, i) => ({ month: `Month ${i + 1}`, title: l.title, href: "#phase-1" })),
  },
  {
    name: "Phase 2: Communication",
    rail: "border-blue",
    dot: "bg-blue",
    stops: PHASE_2_LEVELS.map((l, i) => ({ month: `Month ${i + 4}`, title: l.title, href: "#phase-2" })),
  },
  {
    name: "Phase 3: Exam prep",
    rail: "border-red",
    dot: "bg-red",
    stops: [{ month: "Months 6–7", title: "TEF or TCF Canada exam prep", href: "#phase-3" }],
  },
];

/**
 * Program page opener: the whole 7-month route on one line, from the first
 * lesson to exam day. Each stop jumps to its phase in the syllabus below.
 */
export default function ProgramHero() {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-14 lg:px-10 lg:pb-20 lg:pt-20">
        <div className="program-rise max-w-2xl">
          <h1 className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Seven months, one route.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/70">
            From your first French word to TEF or TCF Canada exam day. Each month is one
            level, and if you already know some French you can join further along.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#route"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim"
            >
              Read the full syllabus
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              See batches and fees
            </Link>
          </div>
        </div>

        {/* The route: vertical on phones, one horizontal line on large screens. */}
        <div className="program-rise mt-14 grid gap-8 [animation-delay:150ms] lg:mt-16 lg:grid-cols-[15fr_10fr_6fr_auto] lg:gap-0">
          {PHASES.map((phase) => (
            <div key={phase.name}>
              <p className="mb-4 text-sm font-medium text-white/55 lg:whitespace-nowrap lg:pr-6">{phase.name}</p>
              <ol className={`space-y-5 border-l-2 lg:flex lg:space-y-0 lg:border-l-0 lg:border-t-2 ${phase.rail}`}>
                {phase.stops.map((stop) => (
                  <li key={stop.month} className="relative pl-6 lg:flex-1 lg:pl-0 lg:pr-6 lg:pt-6">
                    <span
                      className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ring-navy lg:-top-[7px] lg:left-0 ${phase.dot}`}
                    />
                    <Link
                      href={stop.href}
                      className="group block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-soft"
                    >
                      <span className="block text-xs text-white/50">{stop.month}</span>
                      <span className="mt-1 block font-medium leading-snug text-white/90 underline-offset-4 group-hover:underline">
                        {stop.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-0 lg:pt-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red text-white shadow-lg shadow-black/30">
              <Flag className="h-4 w-4" />
            </span>
            <p className="font-display text-lg font-semibold lg:mt-3">Exam day</p>
          </div>
        </div>
      </div>
    </section>
  );
}
