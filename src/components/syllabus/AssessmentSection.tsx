import Reveal from "@/components/Reveal";
import { ASSESSMENT_CARDS } from "@/data/syllabus";
import { SYLLABUS_ICONS } from "./icons";

export default function AssessmentSection() {
  return (
    <section className="bg-red-soft/25 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            How Progress Is Evaluated
          </h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-red" />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ASSESSMENT_CARDS.map((card, index) => {
            const Icon = SYLLABUS_ICONS[card.icon];
            return (
              <Reveal key={card.title} variant="scale" delayMs={index * 80}>
                <div className="laminate group flex h-full flex-col rounded-2xl border border-navy/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-red/20">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold text-navy">{card.title}</h3>
                  {card.intro ? (
                    <p className="mt-2 text-sm text-navy/60">{card.intro}</p>
                  ) : null}
                  {card.items ? (
                    <ul className="mt-2 space-y-1.5">
                      {card.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-navy/70">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-red/50" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {card.body ? (
                    <p className="mt-2 text-sm leading-relaxed text-navy/60">{card.body}</p>
                  ) : null}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
