import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, BookOpen, MessageSquareText, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import Reveal from "@/components/Reveal";
import { STUDENT_RESULTS } from "@/data/results";
import ResultsStrip from "./ResultsStrip";

const PROMISES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: BookOpen, title: "The syllabus, up front", body: "See exactly what every level covers before you pay." },
  { icon: Users, title: "4–8 students a batch", body: "Small enough that the teacher hears you speak every class." },
  { icon: MessageSquareText, title: "Personal feedback", body: "Your speaking and writing are corrected one by one, not in bulk." },
  { icon: ShieldCheck, title: "7-day money-back", body: "Try a week of classes. Not for you? You get a full refund." },
];

export default function ProofSection() {
  return (
    <>
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
                Hitesh&apos;s own TEF Canada result sheet.
              </figcaption>
              <span className="absolute -right-4 -top-4 flex rotate-[6deg] items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-navy/30">
                <BadgeCheck className="h-4 w-4 text-blue-soft" />
                TEF Canada C1
              </span>
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

            <p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-blue">
              What we promise you
            </p>
            <ul className="mt-4 grid gap-px overflow-hidden rounded-3xl border border-navy/10 bg-navy/10 sm:grid-cols-2">
              {PROMISES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="group flex gap-4 bg-white p-5 transition-colors duration-300 hover:bg-cream">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-soft text-blue transition-all duration-300 group-hover:bg-blue group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-navy">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-navy/65">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
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
