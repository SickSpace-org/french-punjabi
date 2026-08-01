import Reveal from "@/components/Reveal";

export default function ResultsHero() {
  return (
    <section className="relative overflow-hidden bg-cream pt-16 pb-14 lg:pt-20 lg:pb-16">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-red-soft/60 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-10">
        <Reveal>
          <span className="inline-flex items-center rounded-full border border-navy/10 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-navy/70 shadow-sm">
            Student Results
          </span>
        </Reveal>

        <Reveal delayMs={80}>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
            Real Students. Real Progress.
          </h1>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-navy/70">
            Reviews and results from students learning French with
            AngrishFrançais.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
