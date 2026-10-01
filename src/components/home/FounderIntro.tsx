import Image from "next/image";
import { Check } from "lucide-react";
import Reveal from "@/components/Reveal";

const CREDENTIALS = ["TEF Canada C1", "TEF & TCF specialist", "Structured 7-month syllabus"];

const PROMISES = [
  "A clear syllabus for every level, before you pay",
  "Small batches, so the teacher hears you speak",
  "Personal feedback on your speaking and writing",
  "7 days of classes with a full refund if it isn't for you",
];

export default function FounderIntro() {
  return (
    <section id="about" className="relative overflow-hidden bg-cream-dim py-20 lg:py-28">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-soft/60 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[0.85fr_1fr] lg:gap-20 lg:px-10">
        <Reveal variant="left">
          <div className="relative mx-auto max-w-sm">
            <figure className="relative rotate-[-3deg] rounded-2xl bg-white p-3 shadow-2xl shadow-navy/15 transition-transform duration-700 hover:rotate-0 hover:scale-[1.02]">
              <Image
                src="/images/hitesh-tef-certificate.jpg"
                alt="Hitesh Angrish's official TEF Canada Attestation de Résultats"
                width={1179}
                height={1254}
                className="h-auto w-full rounded-lg"
              />
              <figcaption className="px-1 pb-1 pt-3 text-sm text-navy/60">
                Hitesh&apos;s own TEF Canada result sheet.
              </figcaption>
            </figure>
            <div className="seal absolute -right-5 -top-6 flex h-24 w-24 items-center justify-center rounded-full bg-red text-center text-white shadow-xl shadow-red/40">
              <svg viewBox="0 0 100 100" className="seal-ring absolute inset-0 h-full w-full" aria-hidden="true">
                <defs>
                  <path id="seal-path" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
                </defs>
                <text className="fill-white/80 text-[9.5px] font-semibold uppercase tracking-[0.25em]">
                  <textPath href="#seal-path">Certified · TEF Canada · Certified ·</textPath>
                </text>
              </svg>
              <span className="font-display text-2xl font-bold leading-none">C1</span>
            </div>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">Meet your mentor</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
              Taught by someone who sat the exam.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-navy/70">
              Hitesh Angrish scored C1 on TEF Canada and built AngrishFrançais around what
              the TEF and TCF actually test. Every class breaks grammar and vocabulary into
              lessons that are easy to follow, with a steady focus on exam performance.
            </p>
          </Reveal>

          <Reveal delayMs={120}>
            <ul className="mt-7 flex flex-wrap gap-2">
              {CREDENTIALS.map((c) => (
                <li
                  key={c}
                  className="rounded-full border border-navy/10 bg-white px-4 py-2 text-sm font-semibold text-navy shadow-sm"
                >
                  {c}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delayMs={220}>
            <div className="mt-10">
              <p className="font-semibold text-navy">What we promise</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {PROMISES.map((p) => (
                  <li
                    key={p}
                    className="flex gap-3 rounded-2xl border border-navy/8 bg-white p-4 text-[15px] leading-snug text-navy/80 shadow-sm"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
