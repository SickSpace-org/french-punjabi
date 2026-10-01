"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  PHASE_1_LEVELS,
  PHASE_2_LEVELS,
  PHASE_3_LEVELS,
  PHASE_META,
  type SyllabusLevel,
} from "@/data/syllabus";
import { SYLLABUS_ICONS } from "@/components/syllabus/icons";
import TopicList from "@/components/syllabus/TopicList";
import { courseHref } from "@/lib/courseNav";

type Stop = { level: SyllabusLevel; month: string };

const PHASES: { months: string; stops: Stop[] }[] = [
  {
    months: "Months 1–3",
    stops: PHASE_1_LEVELS.map((level, i) => ({ level, month: `Month ${i + 1}` })),
  },
  {
    months: "Months 4–5",
    stops: PHASE_2_LEVELS.map((level, i) => ({ level, month: `Month ${i + 4}` })),
  },
  {
    months: "Months 6–7",
    stops: PHASE_3_LEVELS.map((level) => ({ level, month: "Months 6–7" })),
  },
];

/** 0→1 as the section scrolls past the middle of the viewport. */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const mid = window.innerHeight * 0.55;
      const p = (mid - rect.top) / rect.height;
      setProgress(Math.min(1, Math.max(0, p)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, progress };
}

function LevelStop({
  stop,
  phaseNumber,
  levelNumber,
}: {
  stop: Stop;
  phaseNumber: number;
  levelNumber: number;
}) {
  const [open, setOpen] = useState(false);
  const { level } = stop;
  const panelId = `${level.id}-curriculum`;

  return (
    <li className="relative pl-12 sm:pl-16">
      <span className="absolute left-[15px] top-6 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-navy shadow ring-4 ring-cream sm:left-[23px]" />

      <div
        className={`rounded-2xl border bg-white transition-shadow duration-300 ${
          open ? "border-blue/30 shadow-xl shadow-navy/10" : "border-navy/10 hover:shadow-md"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-start justify-between gap-4 rounded-2xl p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue sm:p-6"
        >
          <div>
            <p className="text-sm text-navy/50">
              {stop.month} <span className="text-navy/25">/</span> {level.label}
            </p>
            <h4 className="mt-1 font-display text-lg font-semibold text-navy sm:text-xl">
              {level.title}
            </h4>
            <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-navy/65">
              {level.summary}
            </p>
          </div>
          <span
            className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
              open ? "rotate-180 border-blue bg-blue text-white" : "border-navy/15 text-navy"
            }`}
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
            <span className="sr-only">{open ? "Hide" : "Show"} full syllabus</span>
          </span>
        </button>

        <div
          id={panelId}
          className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-navy/10 px-5 pb-6 pt-5 sm:px-6">
              {level.entryProfile ? (
                <p className="mb-5 rounded-xl bg-cream-dim px-4 py-3 text-sm text-navy/70">
                  <span className="font-semibold text-navy">Who it&apos;s for: </span>
                  {level.entryProfile}
                </p>
              ) : null}

              <div className="grid gap-6 sm:grid-cols-2">
                {level.sections.map((section) => {
                  const Icon = SYLLABUS_ICONS[section.icon];
                  return (
                    <div key={section.title}>
                      <p className="flex items-center gap-2 font-semibold text-navy">
                        <Icon className="h-4 w-4 text-blue" strokeWidth={2} />
                        {section.title}
                      </p>
                      {section.intro ? (
                        <p className="mt-2 text-sm text-navy/60">{section.intro}</p>
                      ) : null}
                      {section.items ? (
                        <TopicList items={section.items} className="mt-3" />
                      ) : null}
                      {section.outro ? (
                        <p className="mt-2 text-sm text-navy/60">{section.outro}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <Link
                href={courseHref(phaseNumber, levelNumber)}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-dark"
              >
                See batches for this level
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function RouteMap() {
  const { ref, progress } = useScrollProgress<HTMLDivElement>();

  return (
    <section id="route" className="scroll-mt-20 bg-cream py-20 lg:py-28">
      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            The full syllabus, level by level.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-navy/65">
            Open any level to see exactly what we cover, then check the batches for it.
          </p>
        </div>

        <div ref={ref} className="relative mt-14">
          {/* The route line: a faint track with a fill that follows your scroll. */}
          <div className="absolute bottom-0 left-[15px] top-0 w-[3px] -translate-x-1/2 rounded-full bg-navy/10 sm:left-[23px]" />
          <div
            className="absolute left-[15px] top-0 w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-blue to-red sm:left-[23px]"
            style={{ height: `${progress * 100}%` }}
          />

          {PHASES.map((phase, p) => {
            const meta = PHASE_META[p];
            return (
              <div
                key={meta.id}
                id={`phase-${p + 1}`}
                className="relative scroll-mt-24 pb-14 last:pb-0"
              >
                <div className="relative pl-12 sm:pl-16">
                  <span className="absolute left-[15px] top-0 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-navy font-display text-sm font-semibold text-white ring-4 ring-cream sm:left-[23px] sm:h-12 sm:w-12 sm:text-lg">
                    {p + 1}
                  </span>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-blue">
                    Phase {p + 1}, {phase.months}
                    <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-xs font-semibold text-navy/70">
                      {phase.stops.length} {phase.stops.length === 1 ? "level" : "levels"}
                    </span>
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
                    {meta.heading}
                  </h3>
                  <p className="mt-3 max-w-2xl leading-relaxed text-navy/65">{meta.objective}</p>
                  {meta.note ? (
                    <p className="mt-2 max-w-2xl text-sm text-navy/50">{meta.note}</p>
                  ) : null}
                </div>

                <ol className="mt-8 space-y-4">
                  {phase.stops.map((stop, i) => (
                    <LevelStop key={stop.level.id} stop={stop} phaseNumber={p + 1} levelNumber={i + 1} />
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
