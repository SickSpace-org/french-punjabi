import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import OfferHero from "@/components/courses/offer/OfferHero";
import { ClosingCta, NumberedSteps, RuledGrid, SectionHeading } from "@/components/courses/offer/OfferSections";
import { getPublicCourses } from "@/lib/courses/getPublicCourses";
import { CALENDLY_URL, ONE_ON_ONE_GOOD_FOR, ONE_ON_ONE_STEPS, perDuration } from "@/data/offerDetails";

export const metadata: Metadata = {
  title: "One-on-one | AngrishFrançais",
  description: "A private session with a teacher, focused on whatever you need most.",
};

export const revalidate = 0;

function BookButton({ label }: { label: string }) {
  return (
    <a
      href={CALENDLY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group/btn inline-flex w-full items-center justify-center gap-2 rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark"
    >
      {label}
      <ArrowUpRight
        className="h-4 w-4 transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5"
        strokeWidth={2.5}
      />
    </a>
  );
}

export default async function OneOnOnePage() {
  let data: Awaited<ReturnType<typeof getPublicCourses>> | null = null;
  try {
    data = await getPublicCourses();
  } catch (error) {
    console.error("[One-on-one] Failed to load course data from Supabase:", error);
  }

  const offer = data?.programOffers.one_on_one_testing;
  if (!offer) notFound();

  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <OfferHero
          eyebrow="Extra support / One-on-one"
          title="Just you and a teacher."
          tagline="A private session with no class around you, spent on whatever you need most: your level, the exam, or one skill."
          offer={offer}
          priceSuffix={perDuration(offer.duration) || undefined}
          facts={[offer.duration, "Private session", "Book online"].filter((f): f is string => Boolean(f))}
          cta={<BookButton label="Book a session" />}
          ctaNote="Opens our booking calendar in a new tab."
        />

        <section className="bg-cream py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <SectionHeading title="Good for" />
            <RuledGrid items={ONE_ON_ONE_GOOD_FOR} />
          </div>
        </section>

        <NumberedSteps title="How a session works" items={ONE_ON_ONE_STEPS} />

        <ClosingCta
          title="Book your session"
          body={`$${offer.base}${perDuration(offer.duration)}. Pick any open slot on the calendar.`}
          cta={<BookButton label="Book a session" />}
        />
      </main>
      <Footer />
    </>
  );
}
