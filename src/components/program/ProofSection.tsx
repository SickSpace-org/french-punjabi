import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import Reveal from "@/components/Reveal";
import { ASSESSMENT_CARDS } from "@/data/syllabus";
import { STUDENT_RESULTS } from "@/data/results";
import ResultsStrip from "./ResultsStrip";

const CHECK_CADENCE = ["Every week", "Every month", "After every mock", "Before your exam"];

const PROMISES = [
  "A clear syllabus for every level, before you pay",
  "Small batches, so the teacher hears you speak",
  "Personal feedback on your speaking and writing",
  "7 days of classes with a full refund if it isn't for you",
];

const NOT_PROMISED = [
  "A guaranteed score. Nobody honest can promise one.",
  "Immigration advice. We teach French; a licensed consultant handles your file.",
];

export default function ProofSection() {
  return (
    <>
      {/* How progress is checked */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <Reveal className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              You&apos;ll always know where you stand.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-navy/65">
              Progress is checked on a fixed rhythm across speaking, writing, listening and
              reading, so there are no surprises on exam day.
            </p>
          </Reveal>

          <ol className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-navy/10 bg-navy/10 sm:grid-cols-2 lg:grid-cols-4">
            {ASSESSMENT_CARDS.map((card, i) => (
              <li key={card.title} className="flex flex-col bg-white p-6">
                <p className="text-sm font-medium text-blue">{CHECK_CADENCE[i]}</p>
                <h3 className="mt-1 font-display text-xl font-semibold text-navy">{card.title}</h3>
                {card.body ? (
                  <p className="mt-3 text-sm leading-relaxed text-navy/65">{card.body}</p>
                ) : null}
                {card.items ? (
                  <ul className="mt-3 space-y-1.5">
                    {card.items.map((item) => (
                      <li key={item} className="text-sm text-navy/65">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who teaches you + results */}
      <section className="bg-cream-dim py-20 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[0.8fr_1fr] lg:gap-16 lg:px-10">
          <Reveal variant="left">
            <figure className="relative mx-auto max-w-sm rotate-[-2deg] rounded-xl bg-white p-3 shadow-2xl shadow-navy/15 transition-transform duration-500 hover:rotate-0">
              <Image
                src="/images/hitesh-tef-certificate.jpg"
                alt="Hitesh Angrish's TEF Canada results certificate"
                width={1179}
                height={1254}
                className="h-auto w-full rounded-md"
              />
              <figcaption className="px-1 pb-1 pt-3 text-sm text-navy/60">
                Hitesh&apos;s own TEF Canada result: C1.
              </figcaption>
            </figure>
          </Reveal>

          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Taught by someone who sat the exam.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-navy/65">
              Hitesh Angrish scored C1 on TEF Canada and built this program around
              what the TEF and TCF actually test.
            </p>

            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-navy">What we promise</p>
                <ul className="mt-3 space-y-2.5">
                  {PROMISES.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px] text-navy/75">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" strokeWidth={2.5} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-navy">What we won&apos;t promise</p>
                <ul className="mt-3 space-y-2.5">
                  {NOT_PROMISED.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px] text-navy/75">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-navy/40" strokeWidth={2.5} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mx-auto mt-20 max-w-6xl px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h3 className="font-display text-2xl font-semibold text-navy">
              Students who took the exam with us
            </h3>
            <Link href="/results" className="text-sm font-semibold text-blue hover:underline">
              See all results
            </Link>
          </div>
          <ResultsStrip results={STUDENT_RESULTS.filter((r) => r.photo)} />
        </div>
      </section>
    </>
  );
}
