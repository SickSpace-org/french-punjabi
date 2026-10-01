import type { SyllabusLevel } from "@/data/syllabus";

type Props = {
  phaseNumber: number;
  levels: SyllabusLevel[];
  months: string[];
  /** Phase 3's levels are alternative tracks (TEF or TCF), not steps in order. */
  tracks?: boolean;
};

/** Hero-side summary of a phase: its levels in order, and where it sits in the 3-phase journey. */
export default function PhaseRoadmap({ phaseNumber, levels, months, tracks = false }: Props) {
  return (
    <div className="rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 backdrop-blur-sm sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-lg font-semibold">
          {tracks ? "Pick your track" : "Inside this phase"}
        </p>
        <p className="text-sm text-white/50">
          {levels.length} levels{tracks ? " · choose one" : ""}
        </p>
      </div>

      <ol className="mt-6">
        {levels.map((level, i) => (
          <li key={level.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!tracks && i < levels.length - 1 ? (
              <span
                aria-hidden
                className="absolute left-[17px] top-10 bottom-1 w-px bg-white/15"
              />
            ) : null}
            <span
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold ${
                i === 0 ? "bg-white text-navy" : "bg-white/10 text-white ring-1 ring-white/20"
              }`}
            >
              {tracks ? (i === 0 ? "A" : "B") : i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-xs font-medium uppercase tracking-wider text-white/45">
                {tracks ? level.label : months[i] ?? level.label}
              </p>
              <p className="mt-1 font-semibold text-white">{level.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/60">{level.summary}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 border-t border-white/10 pt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-white/45">
          Your 7-month route
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((p) => (
            <div key={p}>
              <span
                className={`block h-1.5 rounded-full ${
                  p < phaseNumber ? "bg-white/40" : p === phaseNumber ? "bg-red" : "bg-white/10"
                }`}
              />
              <span
                className={`mt-2 block text-xs ${
                  p === phaseNumber ? "font-semibold text-white" : "text-white/45"
                }`}
              >
                Phase {p}
                {p === phaseNumber ? " · you're here" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
