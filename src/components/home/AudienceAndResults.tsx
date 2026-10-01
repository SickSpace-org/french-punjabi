import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import ResultsStrip from "@/components/program/ResultsStrip";
import { STUDENT_RESULTS } from "@/data/results";

const STATS = [
  { value: 100, suffix: "+", label: "Students trained", caption: "for TEF & TCF Canada" },
  { value: 90, suffix: "%+", label: "Exam success rate", caption: "on TEF & TCF Canada" },
  { value: 7, suffix: "", label: "Month program", caption: "from zero to exam-ready" },
  { value: 10, suffix: "", label: "Students max", caption: "in every grammar batch" },
];

export default function AudienceAndResults() {
  return (
    <section id="our-results" className="relative overflow-hidden bg-navy py-20 text-white lg:py-28">
      <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-red/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[24rem] w-[24rem] rounded-full bg-blue/25 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">Proof, not promises</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            Real students. <span className="italic text-blue-soft/90">Real certificates.</span>
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            Every result below is an official TEF or TCF Canada score sheet from a student
            who prepared with us. Tap any one to see it full size.
          </p>
        </Reveal>

        <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/10 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} variant="fade" delayMs={i * 100} className="h-full">
              <div className="h-full bg-navy-light/70 p-6 backdrop-blur sm:p-8">
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <CountUp
                    end={stat.value}
                    suffix={stat.suffix}
                    delayMs={200 + i * 120}
                    className="font-display text-4xl font-semibold tracking-tight sm:text-5xl"
                  />
                  <p className="mt-2 text-sm font-semibold text-white">{stat.label}</p>
                  <p className="text-xs text-white/55">{stat.caption}</p>
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>

        <Reveal delayMs={150} className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h3 className="font-display text-2xl font-semibold">Recent exam results</h3>
            <Link
              href="/results"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              See all results &amp; reviews
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <ResultsStrip results={STUDENT_RESULTS.filter((r) => r.photo)} />
        </Reveal>
      </div>
    </section>
  );
}
