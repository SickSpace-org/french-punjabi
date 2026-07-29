import { CalendarClock, Layers, Sparkles } from "lucide-react";
import Reveal from "@/components/Reveal";

const PILLS = [
  { icon: Sparkles, label: "7 Months", caption: "Complete Journey" },
  { icon: Layers, label: "3 Phases", caption: "Progressive Learning" },
  { icon: CalendarClock, label: "Flexible", caption: "Batch Timings" },
];

export default function CoursesHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-cream via-red-soft/40 to-cream pt-14 pb-12 lg:pt-16 lg:pb-14">
      <div className="bg-dot-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-red-soft/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-red/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-0 h-px w-1/3 -translate-y-1/2 bg-gradient-to-r from-transparent via-navy/10 to-transparent" />
      <div className="pointer-events-none absolute top-1/2 right-0 h-px w-1/3 -translate-y-1/2 bg-gradient-to-l from-transparent via-navy/10 to-transparent" />

      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-10">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-red/25 bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-dark shadow-sm">
            French Punjabi Courses
          </span>
        </Reveal>

        <Reveal delayMs={80}>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
            Find the Right French <span className="text-red-dark">Program</span> for You
          </h1>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-navy/60">
            Choose your phase, explore available levels and timings, see the
            fees upfront, and enroll in the batch that works for you.
          </p>
        </Reveal>

        <Reveal delayMs={240}>
          <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {PILLS.map(({ icon: Icon, label, caption }) => (
              <div
                key={label}
                className="laminate flex items-center gap-3 rounded-2xl border border-navy/10 border-l-2 border-l-red/40 px-4 py-3.5 text-left transition-all duration-300 hover:-translate-y-0.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream-dim text-navy">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <span>
                  <span className="block text-[13px] font-bold uppercase tracking-wide text-navy">
                    {label}
                  </span>
                  <span className="block text-xs text-navy/50">{caption}</span>
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
