import Reveal from "@/components/Reveal";
import { PHASE_3_ELIGIBILITY, PHASE_3_PRACTICE, PHASE_META } from "@/data/syllabus";
import { SYLLABUS_ICONS } from "./icons";

const meta = PHASE_META[2];

export default function Phase3Practice() {
  const GraduationCap = SYLLABUS_ICONS.graduationCap;

  return (
    <div id={meta.id} className="scroll-mt-36">
      <Reveal>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-navy">{meta.code}</p>
        <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-navy sm:text-3xl">
          {meta.heading}
        </h3>
        <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-navy/50">
          {meta.subheading}
        </p>
        <div className="mt-3 h-1 w-14 rounded-full bg-navy" />
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy/60">{meta.objective}</p>
      </Reveal>

      <Reveal delayMs={80} className="mt-6">
        <div className="flex items-start gap-3 rounded-2xl border border-navy/10 bg-cream-dim/60 p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-navy">
            <GraduationCap className="h-4.5 w-4.5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-navy/50">
              Phase 3 Entry
            </p>
            <p className="mt-1 text-sm leading-relaxed text-navy/70">{PHASE_3_ELIGIBILITY}</p>
          </div>
        </div>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PHASE_3_PRACTICE.map((section, index) => {
          const Icon = SYLLABUS_ICONS[section.icon];
          return (
            <Reveal key={section.title} variant="scale" delayMs={index * 80}>
              <div className="laminate group h-full rounded-2xl border border-navy/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-red/20">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <h4 className="mt-3 font-display text-base font-bold text-navy">
                  {section.title}
                </h4>
                {section.intro ? (
                  <p className="mt-2 text-sm text-navy/60">{section.intro}</p>
                ) : null}
                {section.items ? (
                  <ul className="mt-2 space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-navy/70">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-red/50" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
