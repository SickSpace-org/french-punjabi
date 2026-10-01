"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BadgeCheck, ZoomIn } from "lucide-react";
import Reveal from "@/components/Reveal";
import { STUDENT_RESULTS } from "@/data/results";
import ResultLightbox from "./ResultLightbox";

type Filter = "All" | "TEF" | "TCF";
const FILTERS: Filter[] = ["All", "TEF", "TCF"];

function examOf(text: string): Filter | null {
  if (text.includes("TEF")) return "TEF";
  if (text.includes("TCF")) return "TCF";
  return null;
}

/** Filterable certificate wall; each card opens the full result in a lightbox. */
export default function StudentResultsGrid() {
  const all = useMemo(() => STUDENT_RESULTS.filter((r) => r.photo), []);
  const [filter, setFilter] = useState<Filter>("All");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const shown = useMemo(
    () => (filter === "All" ? all : all.filter((r) => examOf(`${r.name} ${r.batch}`) === filter)),
    [all, filter]
  );

  const close = useCallback(() => {
    setOpenIndex((i) => {
      if (i !== null) triggerRefs.current[i]?.focus();
      return null;
    });
  }, []);

  const step = useCallback(
    (dir: number) => setOpenIndex((i) => (i === null ? i : (i + dir + shown.length) % shown.length)),
    [shown.length]
  );

  return (
    <section id="certificates" className="scroll-mt-20 bg-cream py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">Certificate wall</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
              Students who made it happen.
            </h2>
            <p className="mt-4 text-lg text-navy/65">Tap any certificate to see the full result sheet.</p>
          </Reveal>

          <Reveal delayMs={100}>
            <div role="group" aria-label="Filter by exam" className="flex gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-navy/10">
              {FILTERS.map((f) => {
                const count = f === "All" ? all.length : all.filter((r) => examOf(`${r.name} ${r.batch}`) === f).length;
                const active = f === filter;
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
                      active ? "bg-navy text-white shadow-md" : "text-navy/65 hover:text-navy"
                    }`}
                  >
                    {f === "All" ? "All" : `${f} Canada`}
                    <span className={`ml-1.5 text-xs ${active ? "text-white/60" : "text-navy/40"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>

        <ul key={filter} className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
          {shown.map((r, i) => {
            const exam = examOf(`${r.name} ${r.batch}`);
            return (
              <li key={r.id} className="program-rise" style={{ animationDelay: `${i * 70}ms` }}>
                <button
                  ref={(el) => {
                    triggerRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  aria-label={`View ${r.name}'s result full size`}
                  className="group block w-full overflow-hidden rounded-3xl bg-white text-left shadow-sm outline-none ring-1 ring-navy/8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-navy/15 focus-visible:ring-2 focus-visible:ring-blue"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-white">
                    <Image
                      src={r.photo!}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 380px, 50vw"
                      className="object-contain p-2 transition-transform duration-700 group-hover:scale-105"
                    />
                    {exam ? (
                      <span className="absolute left-3 top-3 rounded-full bg-navy px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
                        {exam}
                      </span>
                    ) : null}
                    <span className="absolute inset-0 flex items-center justify-center bg-navy/0 transition-colors duration-300 group-hover:bg-navy/30">
                      <span className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white text-navy opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                        <ZoomIn className="h-5 w-5" />
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-navy/8 p-4 sm:p-5">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold text-navy sm:text-lg">{r.name}</p>
                      <p className="truncate text-xs font-semibold uppercase tracking-wide text-red sm:text-sm sm:normal-case sm:tracking-normal">
                        {r.batch}
                      </p>
                    </div>
                    <BadgeCheck className="hidden h-6 w-6 shrink-0 text-blue sm:block" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {openIndex !== null ? (
        <ResultLightbox results={shown} index={openIndex} onClose={close} onStep={step} />
      ) : null}
    </section>
  );
}
