"use client";

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { GOALS } from "@/data/goals";

const PHASE_NAMES = ["Foundation", "Communication", "Exam prep"];

export default function GoalPicker() {
  const [goalId, setGoalId] = useState(GOALS[0].id);
  const goal = GOALS.find((g) => g.id === goalId) ?? GOALS[0];

  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-red/30 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 lg:px-10 lg:pb-24 lg:pt-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-white/60">The AngrishFrançais program</p>
          <h1 className="program-rise mt-3 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Tell us where French is taking you.
          </h1>
          <p className="program-rise mt-5 max-w-xl text-lg leading-relaxed text-white/70 [animation-delay:120ms]">
            Pick your goal and see how French helps you get there, and how our
            7-month program takes you from your first word to exam day.
          </p>
        </div>

        <div
          role="group"
          aria-label="Your goal"
          className="program-rise mt-10 flex flex-wrap gap-2 [animation-delay:220ms]"
        >
          {GOALS.map((g) => {
            const active = g.id === goalId;
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={active}
                onClick={() => setGoalId(g.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy ${
                  active
                    ? "bg-white text-navy shadow-lg shadow-black/20"
                    : "border border-white/20 text-white/80 hover:border-white/40 hover:text-white"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        {/* Result panel: re-keyed on goal so its contents replay their entrance. */}
        <div
          key={goal.id}
          aria-live="polite"
          className="program-rise mt-6 grid gap-px overflow-hidden rounded-3xl bg-white/10 [animation-delay:300ms] lg:grid-cols-[1.3fr_1fr]"
        >
          <div className="bg-navy-light/80 p-6 sm:p-8">
            <p className="text-sm text-white/55">{goal.short}: how French helps</p>
            <p className="goal-headline mt-2 max-w-xl font-display text-2xl font-semibold leading-snug sm:text-3xl">
              {goal.headline}
            </p>

            <ul className="mt-8 space-y-4">
              {goal.why.map((line, i) => (
                <li
                  key={line}
                  className="goal-item flex gap-3.5 text-[15px] leading-relaxed text-white/85"
                  style={{ animationDelay: `${450 + i * 140}ms` }}
                >
                  <span
                    className="goal-pop mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red text-white"
                    style={{ animationDelay: `${550 + i * 140}ms` }}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col bg-navy-light/50 p-6 sm:p-8">
            <p className="text-sm text-white/55">Your route through the program</p>

            {/* Three stops on a line that draws itself left to right. */}
            <div className="relative mt-5">
              <div className="absolute left-[16.66%] right-[16.66%] top-4 h-0.5 bg-white/10" />
              <div className="goal-fill absolute left-[16.66%] right-[16.66%] top-4 h-0.5 bg-gradient-to-r from-blue to-red" />
              <ol className="relative grid grid-cols-3 gap-2">
                {PHASE_NAMES.map((name, i) => (
                  <li key={name}>
                    <a
                      href={`#phase-${i + 1}`}
                      className="group flex flex-col items-center text-center outline-none"
                    >
                      <span
                        className="goal-pop flex h-8 w-8 items-center justify-center rounded-full bg-white font-display text-sm font-semibold text-navy shadow-lg ring-4 ring-navy-light transition-transform duration-300 group-hover:scale-110 group-focus-visible:ring-white/60"
                        style={{ animationDelay: `${400 + i * 350}ms` }}
                      >
                        {i + 1}
                      </span>
                      <span className="mt-3 text-xs font-semibold text-white/85 group-hover:text-white">
                        {name}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-8 text-[15px] leading-relaxed text-white/70">
              Every goal starts at the same place. Already know some French? Join at a
              later month and skip what you&apos;ve covered.
            </p>

            {goal.sourceHref ? (
              <a
                href={goal.sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1.5 pt-6 text-xs text-white/55 underline-offset-4 hover:text-white hover:underline"
              >
                {goal.sourceLabel}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-white/40">
          Summary of official Canadian and Québec rules, which change from time to
          time. Confirm on canada.ca or quebec.ca before you apply. We teach French;
          for immigration advice, speak to a licensed consultant (RCIC) or lawyer.
        </p>
      </div>
    </section>
  );
}
