import Reveal from "@/components/Reveal";

export default function StructureHero() {
  return (
    <section className="relative overflow-hidden bg-cream pt-16 pb-14 lg:pt-20 lg:pb-16">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-soft/50 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-10">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-navy/10 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-navy/70 shadow-sm">
            7-Month Intensive Program
          </span>
        </Reveal>

        <Reveal delayMs={80}>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
            Your French Learning Journey
          </h1>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-navy/70">
            A structured journey from French foundations to practical
            communication and focused exam preparation.
          </p>
        </Reveal>

        <Reveal delayMs={240}>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-semibold text-navy/60">
            <span>7 Months</span>
            <span className="text-navy/25">•</span>
            <span>3 Phases</span>
            <span className="text-navy/25">•</span>
            <span>Progressive Learning</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
