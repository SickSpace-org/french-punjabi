"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { StudentResult } from "@/data/results";

/** Full-size certificate viewer with prev/next, Escape and arrow-key support. */
export default function ResultLightbox({
  results,
  index,
  onClose,
  onStep,
}: {
  results: StudentResult[];
  index: number;
  onClose: () => void;
  onStep: (dir: number) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = results[index];

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onStep]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${open.name}, ${open.batch}`}
      className="lightbox-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-navy-dark/85 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" />
      </button>

      {results.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStep(-1);
            }}
            aria-label="Previous result"
            className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStep(1);
            }}
            aria-label="Next result"
            className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      ) : null}

      <figure
        key={open.id}
        onClick={(e) => e.stopPropagation()}
        className="lightbox-zoom flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="relative h-[72vh] w-full bg-white">
          <Image
            src={open.photo!}
            alt={`${open.name}'s ${open.batch} result`}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-contain"
            priority
          />
        </div>
        <figcaption className="flex items-center justify-between gap-4 border-t border-navy/10 px-5 py-3">
          <span>
            <span className="block font-semibold text-navy">{open.name}</span>
            <span className="block text-sm text-navy/55">{open.batch}</span>
          </span>
          <span className="text-sm text-navy/45">
            {index + 1} / {results.length}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
