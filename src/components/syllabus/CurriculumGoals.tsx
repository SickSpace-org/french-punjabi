import Reveal from "@/components/Reveal";
import { CURRICULUM_GOALS } from "@/data/syllabus";
import { SYLLABUS_ICONS } from "./icons";

export default function CurriculumGoals() {
  return (
    <section className="bg-red-soft/30 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            What This Program Builds
          </h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-red" />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {CURRICULUM_GOALS.map((goal, index) => {
            const Icon = SYLLABUS_ICONS[goal.icon];
            return (
              <Reveal key={goal.number} variant="scale" delayMs={index * 80}>
                <div className="laminate group flex h-full flex-col rounded-2xl border border-navy/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-red/25">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-2xl font-bold text-navy/15">
                      {goal.number}
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-navy">
                    {goal.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-navy/60">{goal.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
