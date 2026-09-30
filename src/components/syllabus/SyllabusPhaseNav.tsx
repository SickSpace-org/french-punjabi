"use client";

import { useEffect, useState } from "react";

const PHASES = [
  { id: "syllabus-phase-1", label: "Phase 1 — Foundation" },
  { id: "syllabus-phase-2", label: "Phase 2 — Application" },
  { id: "syllabus-phase-3", label: "Phase 3 — Exam Prep" },
];

export default function SyllabusPhaseNav() {
  const [activeId, setActiveId] = useState(PHASES[0].id);

  useEffect(() => {
    const sections = PHASES.map((phase) => document.getElementById(phase.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sticky top-16 z-40 border-b border-navy/8 bg-white/90 py-3 backdrop-blur-md lg:top-20">
      <div className="mx-auto flex max-w-7xl justify-center px-6 lg:px-10">
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-navy/10 bg-cream-dim p-1.5 shadow-sm">
          {PHASES.map((phase) => {
            const isActive = activeId === phase.id;
            return (
              <a
                key={phase.id}
                href={`#${phase.id}`}
                onClick={() => setActiveId(phase.id)}
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-300 sm:text-sm ${
                  isActive
                    ? "bg-red text-white shadow-md shadow-red/30"
                    : "text-navy/70 hover:bg-white hover:text-navy"
                }`}
              >
                {phase.label}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
