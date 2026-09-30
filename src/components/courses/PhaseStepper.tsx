import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import type { Phase } from "@/lib/courses/types";

export default function PhaseStepper({ phases }: { phases: Phase[] }) {
  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
      {phases.map((phase, index) => (
        <div key={phase.id} className="flex items-center gap-3 sm:contents">
          <Reveal variant="scale" delayMs={index * 90} className="flex-1 sm:flex-none">
            <a
              href={`#${phase.id}`}
              className="block rounded-2xl border border-navy/10 bg-white px-5 py-3.5 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red/25 hover:shadow-md sm:w-52"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-red">
                {phase.number}
              </p>
              <p className="mt-0.5 font-display text-sm font-bold text-navy">{phase.title}</p>
              <p className="mt-0.5 text-xs text-navy/50">{phase.months}</p>
            </a>
          </Reveal>
          {index < phases.length - 1 ? (
            <ArrowRight
              className="hidden h-4 w-4 shrink-0 text-red/40 sm:block"
              strokeWidth={2}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
