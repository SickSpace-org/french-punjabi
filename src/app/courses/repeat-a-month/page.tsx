import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/Reveal";
import OfferHero from "@/components/courses/offer/OfferHero";
import OfferEnrollButton from "@/components/courses/offer/OfferEnrollButton";
import { ClosingCta, NumberedSteps, RuledGrid, SectionHeading } from "@/components/courses/offer/OfferSections";
import type { EnrollSelection } from "@/components/courses/EnrollModal";
import { getPublicCourses } from "@/lib/courses/getPublicCourses";
import { phaseNumberOf } from "@/lib/courseNav";
import { PROGRAM_MONTHS, REPEAT_MONTH_REASONS, REPEAT_MONTH_STEPS } from "@/data/offerDetails";

export const metadata: Metadata = {
  title: "Repeat a Month | AngrishFrançais",
  description: "Take any month of the program again before moving on to the next one.",
};

export const revalidate = 0;

const PHASE_TONE: Record<number, string> = {
  1: "bg-blue-soft text-navy",
  2: "bg-cream-dim text-navy",
  3: "bg-red-soft text-navy",
};

export default async function RepeatMonthPage() {
  let data: Awaited<ReturnType<typeof getPublicCourses>> | null = null;
  try {
    data = await getPublicCourses();
  } catch (error) {
    console.error("[Repeat a month] Failed to load course data from Supabase:", error);
  }

  const offer = data?.programOffers.redo_month;
  if (!offer) notFound();
  const phaseTitle = new Map((data?.phases ?? []).map((p) => [phaseNumberOf(p), p.title]));

  const selection: EnrollSelection = {
    phase: "Redo a Month",
    batch: "Repeat a Program Month",
    timing: "Timing confirmed after enrollment",
    feeLabel: `$${offer.base}`,
    programOfferKey: "redo_month",
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <OfferHero
          eyebrow="Extra support / Repeat a month"
          title="Not ready to move on? Take the month again."
          tagline="Every month builds on the one before it. If a month didn't land, repeat it before the next one starts."
          offer={{ ...offer, label: "Repeat a month" }}
          priceSuffix="/month"
          facts={["Any of the 7 months", "Same classes and checks"]}
          cta={<OfferEnrollButton selection={selection} label="Repeat a month" />}
          ctaNote="Paid on top of your program fee. Timing confirmed after you enroll."
        />

        <section className="bg-cream py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <SectionHeading title="When repeating a month helps" />
            <RuledGrid items={REPEAT_MONTH_REASONS} />
          </div>
        </section>

        <section className="bg-white py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <SectionHeading
              title="Any month, any phase"
              intro="Pick the month you want to go over again. One price, whichever month it is."
            />
            <ol className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {PROGRAM_MONTHS.map(({ month, phase }, i) => (
                <li key={month}>
                  <Reveal delayMs={i * 60} className={`flex h-full flex-col rounded-2xl p-5 ${PHASE_TONE[phase]}`}>
                    <span className="text-sm text-navy/55">Month</span>
                    <span className="font-display text-4xl font-semibold leading-none">{month}</span>
                    <span className="mt-4 text-xs font-medium text-navy/60">
                      Phase {phase}
                      {phaseTitle.get(phase) ? `: ${phaseTitle.get(phase)}` : ""}
                    </span>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <NumberedSteps title="How it works" items={REPEAT_MONTH_STEPS} />

        <ClosingCta
          title="Want to go over a month again?"
          body={`$${offer.base} covers one full month of classes, checks and evaluation.`}
          cta={<OfferEnrollButton selection={selection} label="Repeat a month" />}
        />
      </main>
      <Footer />
    </>
  );
}
