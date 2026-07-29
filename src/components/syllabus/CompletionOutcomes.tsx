import Reveal from "@/components/Reveal";
import { COMPLETION_INTRO, COMPLETION_OUTCOMES } from "@/data/syllabus";
import { SYLLABUS_ICONS } from "./icons";

export default function CompletionOutcomes() {
  return (
    <section className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            What You&apos;ll Have Built
          </h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-red" />
          <div className="mt-5 space-y-3 text-left text-base leading-relaxed text-navy/60 sm:text-center">
            {COMPLETION_INTRO.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {COMPLETION_OUTCOMES.map((outcome, index) => {
            const Icon = SYLLABUS_ICONS[outcome.icon];
            return (
              <Reveal key={outcome.title} variant="scale" delayMs={index * 70}>
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-navy/10 bg-cream-dim/50 px-3 py-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-red/20 hover:bg-white hover:shadow-md">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red">
                    <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <p className="text-sm font-bold text-navy">{outcome.title}</p>
                  <p className="text-xs text-navy/50">{outcome.caption}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
