import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import ProgramHero from "@/components/program/ProgramHero";
import RouteMap from "@/components/program/RouteMap";
import ProofSection from "@/components/program/ProofSection";
import { CONTACT_INFO } from "@/data/contact";
import BookCallButton from "@/components/BookCallButton";

export const metadata: Metadata = {
  title: "Program & Syllabus | AngrishFrançais",
  description:
    "The 7-month AngrishFrançais French program: every level from your first word to exam day, with the full month-by-month syllabus.",
};

export default function ProgramPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <ProgramHero />
        <RouteMap />
        <ProofSection />

        <section className="bg-navy py-20 text-white lg:py-24">
          <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Start at the level that fits you.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
              See upcoming batches and timings, or book a call and we&apos;ll help you
              pick where to begin.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/courses"
                className="inline-flex items-center justify-center rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark"
              >
                See batches
              </Link>
              <BookCallButton
                className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:bg-cream-dim"
              >
                Book a consultation call
              </BookCallButton>
              <a
                href={CONTACT_INFO.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
              >
                Ask on WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
