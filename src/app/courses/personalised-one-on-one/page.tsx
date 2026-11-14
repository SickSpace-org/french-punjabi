import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowDown } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import OfferHero from "@/components/courses/offer/OfferHero";
import { ClosingCta, NumberedSteps, RuledGrid, SectionHeading } from "@/components/courses/offer/OfferSections";
import OneOnOneSection from "@/components/courses/oneOnOne/OneOnOneSection";
import Reveal from "@/components/Reveal";
import { getPublicCourses } from "@/lib/courses/getPublicCourses";
import {
  PERSONALISED_GOOD_FOR,
  PERSONALISED_STEPS,
  PERSONALISED_TITLE,
} from "@/data/personalisedOneOnOne";

export const metadata: Metadata = {
  title: "Personalised One-on-One | AngrishFrançais",
  description:
    "A private French batch with only you and your teacher, at a time slot you choose, with the full student portal included.",
};

export const revalidate = 0;

function PickButton({ label }: { label: string }) {
  return (
    <a
      href="#phases"
      className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark"
    >
      {label}
      <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-y-0.5" strokeWidth={2.5} />
    </a>
  );
}

export default async function PersonalisedOneOnOnePage() {
  let data: Awaited<ReturnType<typeof getPublicCourses>> | null = null;
  try {
    data = await getPublicCourses();
  } catch (error) {
    console.error("[Personalised one-on-one] Failed to load course data from Supabase:", error);
  }

  const offer = data?.programOffers.personalised_one_on_one;
  if (!data || !offer) notFound();

  const price = offer.total ?? offer.base;

  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <OfferHero
          eyebrow="Extra support / One-on-one"
          title="Just you and a teacher."
          tagline="A private batch with only you in it, taught by your own teacher and planned around your level and your exam, with the full student portal included."
          offer={{ ...offer, base: price }}
          priceSuffix="/month"
          facts={["Private batch", "Just you and your teacher", "Student portal included"]}
          cta={<PickButton label="Pick a phase and slot" />}
          ctaNote="Slots are first come, first served."
        />

        <section className="bg-cream py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <SectionHeading title="Good for" />
            <RuledGrid items={PERSONALISED_GOOD_FOR} />
          </div>
        </section>

        <section id="phases" className="scroll-mt-20 bg-cream-dim py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <SectionHeading
              title="Pick your phase"
              intro="Choose the phase you're in. Open slots can be reserved straight away. If a phase has none open, leave your details and we'll tell you when the next one-on-one batch opens."
            />
            <div className="mt-10 space-y-5">
              {data.phases.map((phase, i) => (
                <Reveal key={phase.id} delayMs={i * 90}>
                  <OneOnOneSection
                    phase={{ dbId: phase.dbId, title: phase.title }}
                    slots={phase.oneOnOneSlots}
                    offer={offer}
                    anchorId={phase.id}
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <NumberedSteps title="How it works" items={PERSONALISED_STEPS} />

        <ClosingCta
          title={`Book your ${PERSONALISED_TITLE.toLowerCase()} slot`}
          body={`$${price} per month. Reserve an open time slot, or get notified when the next batch opens.`}
          cta={<PickButton label="Pick a phase and slot" />}
        />
      </main>
      <Footer />
    </>
  );
}
