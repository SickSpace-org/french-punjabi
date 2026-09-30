import Reveal from "@/components/Reveal";

const TIMELINE = [
  { months: "Months 1–3", title: "Foundation" },
  { months: "Months 4–5", title: "Practical Application" },
  { months: "Months 6–7", title: "Exam Preparation" },
];

export default function JourneyTimeline() {
  return (
    <section className="bg-cream py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-blue-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue">
            Program Timeline
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold uppercase tracking-wide text-red-dark sm:text-3xl">
            Your 7-Month Journey
          </h2>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="laminate mx-auto mt-10 w-full max-w-[1000px] rounded-2xl border border-navy/10 p-6 transition-all duration-300 hover:-translate-y-1 sm:p-8">
            <div className="grid grid-cols-1 divide-y divide-navy/8 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {TIMELINE.map((item) => (
                <div
                  key={item.months}
                  className="flex flex-col items-center gap-1 px-2 py-5 text-center first:pt-0 sm:px-6 sm:py-0"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-navy/40">
                    {item.months}
                  </span>
                  <span className="mt-1 font-display text-lg font-bold text-navy">
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
