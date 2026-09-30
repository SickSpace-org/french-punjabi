"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { ROADMAP_MONTHS, ROADMAP_PHASE_BANDS } from "@/data/syllabus";

export default function RoadmapTimeline() {
  const [filledCount, setFilledCount] = useState(0);
  const markerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const nodes = markerRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number((entry.target as HTMLElement).dataset.index);
          setFilledCount((prev) => Math.max(prev, index + 1));
        });
      },
      { rootMargin: "-15% 0px -35% 0px", threshold: 0.2 }
    );

    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-dark">
            Roadmap
          </span>
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            Your 7-Month Roadmap
          </h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-red" />
        </Reveal>

        {/* Phase bands */}
        <Reveal delayMs={80} className="mt-12">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            {ROADMAP_PHASE_BANDS.map((band, index) => (
              <div key={band.id} className="flex items-center gap-3">
                <div
                  className={`rounded-2xl px-6 py-4 text-center text-white shadow-md sm:w-56 ${
                    band.tone === "red"
                      ? "bg-gradient-to-br from-red-dark via-red to-red-dark shadow-red/20"
                      : "bg-gradient-to-br from-navy-dark via-navy to-navy-dark shadow-navy/20"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-white/70">
                    {band.label}
                  </p>
                  <p className="mt-1 font-display text-base font-bold">{band.title}</p>
                  <p className="mt-0.5 text-xs text-white/70">{band.months}</p>
                </div>
                {index < ROADMAP_PHASE_BANDS.length - 1 ? (
                  <ArrowRight
                    className="hidden h-5 w-5 shrink-0 text-red/40 sm:block"
                    strokeWidth={2}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </Reveal>

        {/* Month-by-month vertical timeline */}
        <div className="relative mx-auto mt-16 max-w-3xl">
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-navy/10" />
          <div
            className="absolute left-[15px] top-2 w-0.5 bg-gradient-to-b from-navy via-red to-navy transition-all duration-700 ease-out"
            style={{ height: `${(filledCount / ROADMAP_MONTHS.length) * 100}%` }}
          />

          <div className="space-y-8">
            {ROADMAP_MONTHS.map((month, index) => {
              const isFilled = index < filledCount;
              return (
                <div
                  key={month.id}
                  ref={(el) => {
                    markerRefs.current[index] = el;
                  }}
                  data-index={index}
                  className="relative pl-11"
                >
                  <span
                    className={`absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors duration-500 ${
                      isFilled
                        ? month.tone === "red"
                          ? "border-red bg-red text-white"
                          : "border-navy bg-navy text-white"
                        : "border-navy/15 bg-white text-navy/40"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <Reveal variant="up">
                    <div className="laminate rounded-2xl border border-navy/10 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-red/20 sm:p-6">
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${
                          month.tone === "red" ? "text-red" : "text-navy"
                        }`}
                      >
                        {month.tag}
                      </p>
                      <h4 className="mt-1 font-display text-lg font-bold text-navy">
                        {month.label}
                      </h4>

                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                        Focus
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {month.focus.map((item) => (
                          <span
                            key={item}
                            className="rounded-full bg-cream-dim px-3 py-1 text-xs font-medium text-navy/70"
                          >
                            {item}
                          </span>
                        ))}
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-navy/60">{month.outcome}</p>
                    </div>
                  </Reveal>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
