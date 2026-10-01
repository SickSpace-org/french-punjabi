"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ZoomIn } from "lucide-react";
import ResultLightbox from "@/components/results/ResultLightbox";
import type { StudentResult } from "@/data/results";

/** Horizontal strip of result certificates; clicking one opens it full size. */
export default function ResultsStrip({ results }: { results: StudentResult[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback(() => {
    setOpenIndex((i) => {
      if (i !== null) triggerRefs.current[i]?.focus();
      return null;
    });
  }, []);

  const step = useCallback(
    (dir: number) => setOpenIndex((i) => (i === null ? i : (i + dir + results.length) % results.length)),
    [results.length]
  );

  return (
    <>
      <ul className="scrollbar-hidden mt-6 flex snap-x gap-4 overflow-x-auto pb-4 pt-2">
        {results.map((r, i) => (
          <li key={r.id} className="w-44 shrink-0 snap-start sm:w-52">
            <button
              ref={(el) => {
                triggerRefs.current[i] = el;
              }}
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`View ${r.name}'s result full size`}
              className="group block w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm outline-none ring-1 ring-navy/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-navy/10 focus-visible:ring-2 focus-visible:ring-blue"
            >
              <div className="relative aspect-[3/4]">
                <Image
                  src={r.photo!}
                  alt=""
                  fill
                  sizes="208px"
                  className="object-contain transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-navy/0 transition-colors duration-300 group-hover:bg-navy/25">
                  <span className="flex h-11 w-11 scale-75 items-center justify-center rounded-full bg-white text-navy opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                    <ZoomIn className="h-5 w-5" />
                  </span>
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-navy">{r.name}</p>
                <p className="text-xs text-navy/55">{r.batch}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null ? (
        <ResultLightbox results={results} index={openIndex} onClose={close} onStep={step} />
      ) : null}
    </>
  );
}
