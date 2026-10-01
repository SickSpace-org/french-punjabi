import Reveal from "@/components/Reveal";

type Item = { title: string; body: string };

/** Heading + intro shared by every offer-page section. */
export function SectionHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{title}</h2>
      {intro ? <p className="mt-4 text-lg leading-relaxed text-navy/65">{intro}</p> : null}
    </Reveal>
  );
}

/** Ruled columns, as used for "How classes work" on the phase pages. */
export function RuledGrid({ items }: { items: Item[] }) {
  const cols = items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <div className={`mt-10 grid gap-8 sm:grid-cols-2 ${cols}`}>
      {items.map((item, i) => (
        <Reveal key={item.title} delayMs={i * 90}>
          <div className="border-t-2 border-navy pt-5">
            <h3 className="font-display text-lg font-semibold text-navy">{item.title}</h3>
            <p className="mt-2 leading-relaxed text-navy/65">{item.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/** Numbered steps on a navy band. */
export function NumberedSteps({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="relative overflow-hidden bg-navy py-20 text-white lg:py-24">
      <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        </Reveal>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((step, i) => (
            <li key={step.title}>
              <Reveal delayMs={i * 120} className="h-full rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-display font-semibold text-navy">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-white/65">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Closing call to action at the bottom of an offer page. */
export function ClosingCta({ title, body, cta }: { title: string; body: string; cta: React.ReactNode }) {
  return (
    <section className="bg-cream py-20 lg:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-navy">{title}</h2>
          <p className="mt-3 text-lg text-navy/65">{body}</p>
        </Reveal>
        <div className="w-full shrink-0 sm:w-auto sm:min-w-64">{cta}</div>
      </div>
    </section>
  );
}
