import Reveal from "@/components/Reveal";
import type { PhaseMeta, SyllabusLevel } from "@/data/syllabus";
import LevelAccordion from "./LevelAccordion";

type PhaseCurriculumProps = {
  meta: PhaseMeta;
  levels: SyllabusLevel[];
  tone: "navy" | "red";
  phaseNumber: number;
};

export default function PhaseCurriculum({ meta, levels, tone, phaseNumber }: PhaseCurriculumProps) {
  const accentText = tone === "red" ? "text-red" : "text-navy";
  const accentBar = tone === "red" ? "bg-red" : "bg-navy";
  const badgeClasses =
    tone === "red" ? "bg-red text-white shadow-red/30" : "bg-navy text-white shadow-navy/20";

  return (
    <div id={meta.id} className="scroll-mt-36">
      <Reveal>
        <p className={`text-xs font-bold uppercase tracking-[0.25em] ${accentText}`}>
          {meta.code}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h3 className="font-display text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            {meta.heading}
          </h3>
          {meta.badge ? (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm ${badgeClasses}`}
            >
              {meta.badge}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-navy/50">
          {meta.subheading}
        </p>
        <div className={`mt-3 h-1 w-14 rounded-full ${accentBar}`} />
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-navy/60">{meta.objective}</p>
        {meta.note ? (
          <p className="mt-2 max-w-2xl text-sm italic text-navy/45">{meta.note}</p>
        ) : null}
      </Reveal>

      <div className="mt-8 space-y-5">
        {levels.map((level, index) => (
          <Reveal key={level.id} variant="up" delayMs={index * 80}>
            <LevelAccordion level={level} phaseNumber={phaseNumber} levelNumber={index + 1} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
