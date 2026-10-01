import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/Reveal";
import OfferHero from "@/components/courses/offer/OfferHero";
import OfferEnrollButton from "@/components/courses/offer/OfferEnrollButton";
import { ClosingCta, RuledGrid, SectionHeading } from "@/components/courses/offer/OfferSections";
import type { EnrollSelection } from "@/components/courses/EnrollModal";
import { getPublicCourses } from "@/lib/courses/getPublicCourses";
import { phaseNumberOf } from "@/lib/courseNav";
import { PHASE_DETAILS } from "@/data/phaseDetails";
import { COMPLETE_PROGRAM_INCLUDES } from "@/data/offerDetails";

export const metadata: Metadata = {
  title: "Complete 7-Month Program | AngrishFrançais",
  description:
    "All three phases in one enrollment: from your first French word to TEF/TCF exam day in seven months.",
};

export const revalidate = 0;

export default async function CompleteProgramPage() {
  let data: Awaited<ReturnType<typeof getPublicCourses>> | null = null;
  try {
    data = await getPublicCourses();
  } catch (error) {
    console.error("[Complete program] Failed to load course data from Supabase:", error);
  }

  const offer = data?.programOffers.complete_program;
  if (!offer) notFound();
  const phases = data?.phases ?? [];

  const perPhaseTotal = phases.reduce((sum, p) => sum + p.pricing.full.base, 0);
  const saving = perPhaseTotal - offer.base;
  const duration = offer.duration ?? "7 Months";

  const selection: EnrollSelection = {
    phase: "Complete Program",
    batch: `${duration} Journey — Phase 1 → Phase 2 → Phase 3`,
    timing: "Batch timings confirmed after enrollment",
    feeLabel: `$${offer.base}`,
    programOfferKey: "complete_program",
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <OfferHero
          eyebrow={`Complete program / ${duration}`}
          title="All three phases. One enrollment."
          tagline="Go from your first French word to TEF/TCF exam day without stopping to re-enroll between phases."
          offer={offer}
          facts={[duration, `${phases.length || 3} phases`, "Paid once"]}
          cta={<OfferEnrollButton selection={selection} label="Enroll in the complete program" />}
          ctaNote="Batch timings are confirmed after you enroll."
        />

        {/* The journey */}
        <section className="bg-cream py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <SectionHeading
              title="The journey, phase by phase"
              intro="Each phase picks up exactly where the last one ended. Open any phase to read its full syllabus."
            />

            <ol className="relative mt-12 grid gap-5 lg:grid-cols-3">
              <span
                aria-hidden
                className="pointer-events-none absolute left-8 right-8 top-[3.25rem] hidden h-px bg-gradient-to-r from-blue/40 via-navy/20 to-red/40 lg:block"
              />
              {phases.map((phase, i) => {
                const n = phaseNumberOf(phase);
                const detail = PHASE_DETAILS[n];
                return (
                  <li key={phase.id} className="flex">
                    <Reveal delayMs={i * 120} className="flex w-full">
                      <Link
                        href={`/courses/${phase.id}`}
                        className="group relative flex w-full flex-col rounded-3xl border border-navy/10 bg-white p-7 shadow-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-xl hover:shadow-navy/10"
                      >
                        <div className="flex items-center justify-between">
                          <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-navy font-display text-lg font-semibold text-white ring-8 ring-white transition-colors duration-500 group-hover:bg-red">
                            {n}
                          </span>
                          <span className="text-sm text-navy/50">{phase.months}</span>
                        </div>
                        <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight text-navy">
                          {phase.title}
                        </h3>
                        {detail ? <p className="mt-2 leading-relaxed text-navy/65">{detail.tagline}</p> : null}
                        {detail ? (
                          <p className="mt-auto flex items-center gap-2 pt-6 text-sm font-medium text-navy">
                            Finishes at: {detail.finishesAt}
                            <ArrowRight className="h-3.5 w-3.5 text-navy/40 transition-transform duration-300 group-hover:translate-x-1" />
                          </p>
                        ) : null}
                      </Link>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* What's included */}
        <section className="bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <SectionHeading title="What's included" />
            <RuledGrid items={COMPLETE_PROGRAM_INCLUDES} />
          </div>
        </section>

        {/* Price comparison */}
        {phases.length ? (
          <section className="bg-cream-dim py-20 lg:py-24">
            <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-10">
              <SectionHeading
                title="Complete program or phase by phase?"
                intro={
                  saving > 0
                    ? `Paying for each phase separately adds up to $${perPhaseTotal}. The complete program is $${offer.base}, so you keep $${saving}.`
                    : "You can also pay for each phase on its own, or month by month, from each phase's page."
                }
              />
              <Reveal delayMs={100}>
                <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-navy/10">
                  <ul className="divide-y divide-navy/10">
                    {phases.map((phase) => (
                      <li key={phase.id} className="flex items-center justify-between gap-4 px-6 py-4">
                        <span className="text-navy/70">
                          {phase.number}: {phase.title}
                        </span>
                        <span className="font-medium text-navy">${phase.pricing.full.base}</span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between gap-4 px-6 py-4 text-navy/50">
                      <span>Phase by phase</span>
                      <span className={saving > 0 ? "line-through" : ""}>${perPhaseTotal}</span>
                    </li>
                  </ul>
                  <div className="flex items-center justify-between gap-4 bg-navy px-6 py-5 text-white">
                    <span className="font-semibold">Complete program</span>
                    <span className="flex items-baseline gap-3">
                      {saving > 0 ? (
                        <span className="rounded-full bg-red px-2.5 py-0.5 text-xs font-semibold">Save ${saving}</span>
                      ) : null}
                      <span className="font-display text-2xl font-semibold">${offer.base}</span>
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>
        ) : null}

        <ClosingCta
          title="Ready to start all seven months?"
          body="Enroll now and we'll confirm your batch timing for Phase 1."
          cta={<OfferEnrollButton selection={selection} label="Enroll now" />}
        />
      </main>
      <Footer />
    </>
  );
}
