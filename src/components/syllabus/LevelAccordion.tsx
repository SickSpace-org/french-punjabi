"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SyllabusLevel } from "@/data/syllabus";
import { SYLLABUS_ICONS } from "./icons";

type LevelAccordionProps = {
  level: SyllabusLevel;
};

export default function LevelAccordion({ level }: LevelAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="laminate overflow-hidden rounded-2xl border border-navy/10 transition-all duration-300 hover:border-red/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-col gap-2 p-6 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-red">{level.label}</p>
          <h4 className="mt-1 font-display text-lg font-bold text-navy">
            {level.title}
            {level.subtitle ? (
              <span className="ml-2 font-sans text-sm font-medium text-navy/50">
                {level.subtitle}
              </span>
            ) : null}
          </h4>
          <p className="mt-1.5 text-sm text-navy/60">{level.summary}</p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-navy/15 bg-cream-dim px-4 py-2 text-xs font-bold uppercase tracking-wide text-navy transition-colors duration-300 ${
            open ? "border-red/30 bg-red-soft text-red-dark" : ""
          }`}
        >
          {open ? "Hide Curriculum" : "Explore Curriculum"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            strokeWidth={2.5}
          />
        </span>
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-navy/10 px-6 pb-6 pt-5">
            {level.entryProfile ? (
              <p className="mb-5 rounded-xl border-l-2 border-red/40 bg-cream-dim/60 px-4 py-3 text-sm text-navy/70">
                <span className="font-bold uppercase tracking-wide text-navy/50">
                  Entry Profile —{" "}
                </span>
                {level.entryProfile}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {level.sections.map((section) => {
                const Icon = SYLLABUS_ICONS[section.icon];
                return (
                  <div key={section.title}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-soft text-red">
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                      <p className="text-xs font-bold uppercase tracking-wide text-navy">
                        {section.title}
                      </p>
                    </div>
                    {section.intro ? (
                      <p className="mt-2 text-sm text-navy/60">{section.intro}</p>
                    ) : null}
                    {section.items ? (
                      <ul className="mt-2 space-y-1.5">
                        {section.items.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-navy/70">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-red/50" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {section.outro ? (
                      <p className="mt-2 text-sm text-navy/60">{section.outro}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
