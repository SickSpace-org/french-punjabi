import {
  ArrowRight,
  ClipboardCheck,
  MessagesSquare,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { courseHref } from "@/lib/courseNav";

type Level = {
  label: string;
  title: string;
  description: string;
  tags?: string[];
};

type Phase = {
  number: string;
  /** Numeric phase used to build the Courses page deep link, e.g. 1. */
  phaseNumber: number;
  label: string;
  heading: string;
  badge: string;
  description: string;
  icon: LucideIcon;
  levels: Level[];
};

const PHASES: Phase[] = [
  {
    number: "01",
    phaseNumber: 1,
    label: "Phase 1",
    heading: "Build Your French Foundation",
    badge: "3 Levels",
    description:
      "Start from the fundamentals of French and progressively build the grammar, vocabulary, pronunciation, and sentence-building foundation needed for practical communication.",
    icon: Sprout,
    levels: [
      {
        label: "Level 1",
        title: "A1 Starter",
        description:
          "From zero to basic French. Students begin with pronunciation, basic vocabulary, sentence formation, and essential French foundations.",
      },
      {
        label: "Level 2",
        title: "A1 Grammar Expansion",
        description:
          "Build stronger sentences and expand everyday communication. Students develop their grammar, vocabulary, conjugation, and ability to communicate about familiar topics.",
      },
      {
        label: "Level 3",
        title: "A1–A2 Foundation",
        description:
          "Complete the core grammar foundation and prepare for practical French. Students begin working with broader sentence structures, past/future communication, and connecting ideas naturally.",
      },
    ],
  },
  {
    number: "02",
    phaseNumber: 2,
    label: "Phase 2",
    heading: "Turn Knowledge Into Communication",
    badge: "2 Levels",
    description:
      "Move beyond learning grammar in isolation and start using French through structured speaking, writing, listening, and reading activities.",
    icon: MessagesSquare,
    levels: [
      {
        label: "Level 1",
        title: "Practical Communication",
        description:
          "Students begin applying their French through structured speaking and writing activities based on real communication situations.",
        tags: ["Speaking", "Writing"],
      },
      {
        label: "Level 2",
        title: "Complete Skill Practice",
        description:
          "Students progress into more advanced speaking and writing tasks while integrating listening and reading practice.",
        tags: ["Speaking", "Writing", "Listening", "Reading"],
      },
    ],
  },
  {
    number: "03",
    phaseNumber: 3,
    label: "Phase 3",
    heading: "Prepare for Exam Performance",
    badge: "2 Levels",
    description:
      "The final stage focuses on applying existing French knowledge under exam-style conditions through focused practice, correction, and performance improvement.",
    icon: ClipboardCheck,
    levels: [
      {
        label: "Level 1",
        title: "Exam Practice",
        description:
          "Focus on applying speaking, writing, listening, and reading skills through structured exam-style practice.",
        tags: ["Speaking", "Writing", "Listening", "Reading"],
      },
      {
        label: "Level 2",
        title: "Mock Tests & Final Preparation",
        description:
          "Focus on timed practice, mock exams, corrections, feedback, confidence, and final exam readiness.",
        tags: ["Mock Tests", "Timed Practice", "Feedback", "Exam Readiness"],
      },
    ],
  },
];

export default function ProgramJourney() {
  return (
    <section className="bg-white py-24 lg:py-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-blue-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue">
            The Program Journey
          </span>
          <h2 className="mt-5 font-display text-3xl font-semibold uppercase tracking-tight text-navy sm:text-4xl">
            Three Phases, One Clear Path
          </h2>
        </Reveal>

        <div className="relative mt-16">
          <Reveal
            variant="fade"
            durationMs={900}
            className="pointer-events-none absolute left-7 top-2 bottom-2 w-px bg-navy/15"
          />

          {PHASES.map((phase, phaseIndex) => (
            <div
              key={phase.number}
              className={`relative flex gap-5 sm:gap-6 ${
                phaseIndex !== PHASES.length - 1 ? "pb-16" : ""
              }`}
            >
              <Reveal
                variant="icon"
                delayMs={80}
                className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-navy/10 bg-white shadow-sm"
              >
                <phase.icon className="h-5 w-5 text-red-dark" strokeWidth={2} />
              </Reveal>

              <Reveal className="min-w-0 flex-1 pt-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-navy/40">
                  {phase.label}
                </span>

                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-xl font-bold text-red-dark sm:text-2xl">
                    {phase.heading}
                  </h3>
                  <span className="rounded-full bg-blue-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue">
                    {phase.badge}
                  </span>
                </div>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy/60">
                  {phase.description}
                </p>

                <div
                  className={`mt-6 grid grid-cols-1 gap-4 ${
                    phase.levels.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
                  }`}
                >
                  {phase.levels.map((level, levelIndex) => (
                    <Reveal
                      key={level.title}
                      variant="scale"
                      delayMs={150 + levelIndex * 90}
                    >
                      <Link
                        href={courseHref(phase.phaseNumber, levelIndex + 1)}
                        aria-label={`View ${phase.label} ${level.label} on the Courses page`}
                        className="laminate group/level flex h-full cursor-pointer flex-col rounded-2xl border border-navy/10 p-5 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-red/40 hover:shadow-lg hover:shadow-red/10 focus-visible:-translate-y-1 focus-visible:border-red/40 focus-visible:shadow-lg focus-visible:ring-2 focus-visible:ring-red/50 focus-visible:ring-offset-2"
                      >
                        <span className="text-[11px] font-bold uppercase tracking-wide text-navy/35">
                          {level.label}
                        </span>
                        <h4 className="mt-1 font-display text-base font-bold text-navy">
                          {level.title}
                        </h4>
                        <p className="mt-2 text-xs leading-relaxed text-navy/60">
                          {level.description}
                        </p>
                        {level.tags ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {level.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-cream-dim px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-navy/55"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-bold uppercase tracking-wide text-red">
                          View Level
                          <ArrowRight
                            className="h-3.5 w-3.5 transition-transform duration-300 group-hover/level:translate-x-1 group-focus-visible/level:translate-x-1"
                            strokeWidth={2.5}
                          />
                        </span>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
