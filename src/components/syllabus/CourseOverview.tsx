import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import { PROGRESSION_STEPS } from "@/data/syllabus";

export default function CourseOverview() {
  return (
    <section className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-dark">
            Overview
          </span>
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            Your 7-Month French Learning Path
          </h2>
          <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-red" />
          <p className="mt-5 text-base leading-relaxed text-navy/60">
            This 7-month intensive French course is designed for learners who
            want to build French from the foundation level and progress
            toward practical communication and exam preparation. The
            curriculum is divided into three phases — foundational grammar
            and pronunciation, applied language and practical communication,
            and final exam-focused practice — with development across
            speaking, writing, listening, and reading.
          </p>
        </Reveal>

        <Reveal delayMs={100} className="mt-12">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            {PROGRESSION_STEPS.map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <div className="rounded-2xl border border-navy/10 bg-cream-dim px-5 py-3.5 text-center shadow-sm">
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-navy">
                    {step}
                  </p>
                </div>
                {index < PROGRESSION_STEPS.length - 1 ? (
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-red/50 sm:block" strokeWidth={2} />
                ) : null}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mx-auto mt-6 max-w-xl text-center text-sm text-navy/50">
            The curriculum broadly follows a progression from A1 toward A2
            and B1-level readiness. Completing the program does not
            automatically grant an A1, A2, B1, TEF, or TCF certification or
            result.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
