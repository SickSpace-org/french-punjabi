import Reveal from "@/components/Reveal";
import { HERO_INDICATORS } from "@/data/syllabus";
import { SYLLABUS_ICONS } from "./icons";

export default function SyllabusHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-red-dark via-red to-red-dark pt-14 pb-12 lg:pt-16 lg:pb-14">
      <div className="bg-hairlines pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-navy/20 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-10">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-sm backdrop-blur-sm">
            7-Month Intensive French Curriculum
          </span>
        </Reveal>

        <Reveal delayMs={80}>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            From Beginner French to Exam Readiness
          </h1>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/80">
            A structured pathway from complete beginner foundations to
            practical communication and TCF-style exam preparation.
          </p>
        </Reveal>

        <Reveal delayMs={240}>
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {HERO_INDICATORS.map(({ icon, value }) => {
              const Icon = SYLLABUS_ICONS[icon];
              return (
                <div
                  key={value}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-4 text-center shadow-sm backdrop-blur-md"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-white">
                    {value}
                  </span>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
