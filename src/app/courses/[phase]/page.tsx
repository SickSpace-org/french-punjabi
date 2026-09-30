import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/Reveal";
import PhaseVideo from "@/components/courses/phase/PhaseVideo";
import LevelTabs from "@/components/courses/phase/LevelTabs";
import PhaseEnroll from "@/components/courses/phase/PhaseEnroll";
import { getPublicCourses } from "@/lib/courses/getPublicCourses";
import { phaseNumberOf } from "@/lib/courseNav";
import { PHASE_DETAILS, PR_STEPS } from "@/data/phaseDetails";
import {
  PHASE_1_LEVELS,
  PHASE_2_LEVELS,
  PHASE_3_LEVELS,
  PHASE_META,
  type SyllabusLevel,
} from "@/data/syllabus";
import { CONTACT_INFO } from "@/data/contact";

export const revalidate = 0;

const SYLLABUS: Record<number, { levels: SyllabusLevel[]; months: string[] }> = {
  1: { levels: PHASE_1_LEVELS, months: ["Month 1", "Month 2", "Month 3"] },
  2: { levels: PHASE_2_LEVELS, months: ["Month 4", "Month 5"] },
  3: { levels: PHASE_3_LEVELS, months: ["Months 6–7", "Months 6–7"] },
};

type PageProps = { params: Promise<{ phase: string }> };

function phaseNumberFromSlug(slug: string) {
  const m = slug.match(/^phase-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { phase } = await params;
  const n = phaseNumberFromSlug(phase);
  const meta = PHASE_META[n - 1];
  if (!meta) return { title: "Courses | AngrishFrançais" };
  return {
    title: `Phase ${n}: ${meta.heading} | AngrishFrançais`,
    description: PHASE_DETAILS[n]?.tagline ?? meta.objective,
  };
}

export default async function PhasePage({ params }: PageProps) {
  const { phase: slug } = await params;

  let phases: Awaited<ReturnType<typeof getPublicCourses>>["phases"] = [];
  let loadFailed = false;
  try {
    phases = (await getPublicCourses()).phases;
  } catch (error) {
    console.error("[Phase page] Failed to load course data from Supabase:", error);
    loadFailed = true;
  }

  const index = phases.findIndex((p) => p.id === slug);
  const phase = phases[index];
  const n = phase ? phaseNumberOf(phase) : phaseNumberFromSlug(slug);
  const meta = PHASE_META[n - 1];
  const detail = PHASE_DETAILS[n];
  const syllabus = SYLLABUS[n];
  if (!meta || !detail || !syllabus || (!phase && !loadFailed)) notFound();

  const prev = index > 0 ? phases[index - 1] : undefined;
  const next = index >= 0 && index < phases.length - 1 ? phases[index + 1] : undefined;
  const title = phase?.title ?? meta.heading;

  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        {/* Hero + video */}
        <section className="relative overflow-hidden bg-navy text-white">
          <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-red/25 blur-3xl" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:px-10 lg:pb-24 lg:pt-14">
            <div>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All phases
              </Link>
              <p className="program-rise mt-8 text-sm font-medium text-white/60">
                Phase {n} of 3 <span className="text-white/30">/</span> {phase?.months ?? ""}
              </p>
              <h1 className="program-rise mt-2 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl [animation-delay:80ms]">
                {title}
              </h1>
              <p className="program-rise mt-5 max-w-lg text-lg leading-relaxed text-white/70 [animation-delay:160ms]">
                {detail.tagline}
              </p>

              <div className="program-rise mt-8 flex flex-wrap items-center gap-2 text-sm [animation-delay:240ms]">
                <span className="rounded-full border border-white/20 px-3 py-1.5 text-white/75">
                  Starts from: {detail.startsFrom}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-white/40" />
                <span className="rounded-full bg-white px-3 py-1.5 font-medium text-navy">
                  {detail.finishesAt}
                </span>
              </div>

              <div className="program-rise mt-9 flex flex-wrap gap-3 [animation-delay:320ms]">
                <a
                  href="#batches"
                  className="inline-flex items-center justify-center rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark"
                >
                  See timings and fees
                </a>
                <a
                  href="#syllabus"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
                >
                  Read the syllabus
                </a>
              </div>
            </div>

            <div className="program-rise [animation-delay:200ms]">
              <PhaseVideo url={detail.videoUrl} title={`Phase ${n}: ${title}`} />
            </div>
          </div>
        </section>

        {/* Outcomes */}
        <section className="bg-cream py-20 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:px-10">
            <Reveal>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                What this phase is for
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-navy/65">{meta.objective}</p>
              {meta.note ? <p className="mt-3 text-navy/50">{meta.note}</p> : null}
            </Reveal>
            <Reveal delayMs={100}>
              <p className="font-semibold text-navy">By the end, you can</p>
              <ul className="mt-4 divide-y divide-navy/10 border-y border-navy/10">
                {detail.leaveWith.map((item) => (
                  <li key={item} className="flex gap-3 py-4 text-[17px] text-navy/80">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-blue" strokeWidth={2.5} />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* Full syllabus */}
        <section id="syllabus" className="scroll-mt-20 bg-cream-dim py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <Reveal className="max-w-2xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                The full syllabus, level by level
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-navy/65">
                {syllabus.levels.length} levels, one after another. Pick a level to see
                everything it covers.
              </p>
            </Reveal>
            <div className="mt-10">
              <LevelTabs levels={syllabus.levels} months={syllabus.months} />
            </div>
          </div>
        </section>

        {/* Batches, timings, fees */}
        <section id="batches" className="scroll-mt-20 bg-cream py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <Reveal className="max-w-2xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                Batch timings and fees
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-navy/65">
                Choose a timing, choose full-phase or monthly payment, then enroll. Seats
                shown are live.
              </p>
            </Reveal>
            <div className="mt-10">
              {phase ? (
                <PhaseEnroll phase={phase} />
              ) : (
                <p className="rounded-2xl bg-white p-8 text-center text-navy/70">
                  Timings didn&apos;t load. Refresh the page in a minute, or{" "}
                  <a href={CONTACT_INFO.whatsappHref} className="font-semibold text-blue underline">
                    message us on WhatsApp
                  </a>
                  .
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Canada PR */}
        <section className="relative overflow-hidden bg-navy py-20 text-white lg:py-24">
          <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-6xl px-6 lg:px-10">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-medium text-white/60">Going for Canada PR?</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {detail.pr.heading}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-white/70">{detail.pr.body}</p>
            </Reveal>

            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {PR_STEPS.map((step, i) => (
                <li key={step.title}>
                  <Reveal delayMs={i * 120} className="h-full rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-display font-semibold text-navy">
                      {i + 1}
                    </span>
                    <h3 className="mt-5 font-display text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 leading-relaxed text-white/65">{step.body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/program"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5"
              >
                Compare PR, citizenship and Québec needs
              </Link>
              <p className="max-w-md text-xs leading-relaxed text-white/40">
                Based on IRCC rules, which can change. Confirm on canada.ca before you apply.
                For immigration advice, speak to a licensed consultant (RCIC) or lawyer.
              </p>
            </div>
          </div>
        </section>

        {/* Phase-to-phase navigation */}
        <nav aria-label="Other phases" className="bg-cream">
          <div className="mx-auto grid max-w-6xl sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/courses/${prev.id}`}
                className="group border-b border-navy/10 px-6 py-10 transition-colors hover:bg-white sm:border-b-0 sm:border-r lg:px-10"
              >
                <span className="flex items-center gap-1.5 text-sm text-navy/50">
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                  Previous: {prev.number}
                </span>
                <span className="mt-1 block font-display text-2xl font-semibold text-navy">{prev.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link
                href={`/courses/${next.id}`}
                className="group px-6 py-10 text-right transition-colors hover:bg-white lg:px-10"
              >
                <span className="flex items-center justify-end gap-1.5 text-sm text-navy/50">
                  Next: {next.number}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="mt-1 block font-display text-2xl font-semibold text-navy">{next.title}</span>
              </Link>
            ) : null}
          </div>
        </nav>
      </main>
      <Footer />
    </>
  );
}
