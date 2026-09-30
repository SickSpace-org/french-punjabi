"use client";

import { useRef, useState } from "react";
import type { SyllabusLevel } from "@/data/syllabus";
import { SYLLABUS_ICONS } from "@/components/syllabus/icons";

type LevelTabsProps = {
  levels: SyllabusLevel[];
  /** Month label for each level, same order as `levels`. */
  months: string[];
};

export default function LevelTabs({ levels, months }: LevelTabsProps) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const level = levels[active];

  const focusTab = (i: number) => {
    const next = (i + levels.length) % levels.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Levels in this phase"
        className="grid gap-2 sm:auto-cols-fr sm:grid-flow-col"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") focusTab(active + 1);
          if (e.key === "ArrowLeft") focusTab(active - 1);
        }}
      >
        {levels.map((l, i) => {
          const selected = i === active;
          return (
            <button
              key={l.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${l.id}`}
              aria-selected={selected}
              aria-controls={`panel-${l.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 ${
                selected
                  ? "border-navy bg-navy text-white shadow-lg shadow-navy/20"
                  : "border-navy/10 bg-white text-navy hover:border-navy/25"
              }`}
            >
              <span className={`block text-sm ${selected ? "text-white/60" : "text-navy/50"}`}>
                {months[i]} <span className="opacity-50">/</span> {l.label}
              </span>
              <span className="mt-0.5 block font-display text-lg font-semibold">{l.title}</span>
              <span
                className={`absolute inset-x-0 bottom-0 h-1 origin-left bg-gradient-to-r from-blue to-red transition-transform duration-500 ${
                  selected ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div
        key={level.id}
        role="tabpanel"
        id={`panel-${level.id}`}
        aria-labelledby={`tab-${level.id}`}
        className="program-rise mt-6 rounded-3xl border border-navy/10 bg-white p-6 sm:p-8"
      >
        {level.subtitle ? <p className="text-sm font-medium text-blue">{level.subtitle}</p> : null}
        <p className="mt-1 max-w-2xl text-lg leading-relaxed text-navy/75">{level.summary}</p>

        {level.entryProfile ? (
          <p className="mt-5 rounded-xl bg-cream-dim px-4 py-3 text-sm text-navy/70">
            <span className="font-semibold text-navy">Who it&apos;s for: </span>
            {level.entryProfile}
          </p>
        ) : null}

        <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {level.sections.map((section, i) => {
            const Icon = SYLLABUS_ICONS[section.icon];
            return (
              <div
                key={section.title}
                className="program-rise"
                style={{ animationDelay: `${120 + i * 70}ms` }}
              >
                <p className="flex items-center gap-2.5 font-semibold text-navy">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-soft text-blue">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  {section.title}
                </p>
                {section.intro ? (
                  <p className="mt-3 text-[15px] leading-relaxed text-navy/65">{section.intro}</p>
                ) : null}
                {section.items ? (
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-navy/10 bg-cream px-3 py-1 text-sm text-navy/80"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.outro ? (
                  <p className="mt-3 text-[15px] leading-relaxed text-navy/65">{section.outro}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
