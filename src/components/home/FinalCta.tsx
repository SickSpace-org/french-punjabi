import Link from "next/link";
import { ArrowRight, CalendarClock, MessageCircle } from "lucide-react";
import Reveal from "@/components/Reveal";
import { CONTACT_INFO } from "@/data/contact";
import BookCallButton from "@/components/BookCallButton";

export default function FinalCta() {
  return (
    <section id="contact" className="bg-white px-6 pb-20 lg:px-10 lg:pb-28">
      <Reveal variant="scale">
        <div className="group relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-navy px-8 py-16 text-center shadow-2xl shadow-navy/25 sm:px-16 lg:py-24">
          <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
          <div className="hero-blob pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-blue/40 blur-3xl" />
          <div className="hero-blob pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-red/40 blur-3xl [animation-delay:-6s]" />

          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">Ready when you are</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              Start speaking French <span className="italic text-blue-soft/90">this month.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
              Try the classes for 7 days. If it isn&apos;t for you, get a full refund.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/courses"
                className="group/btn inline-flex items-center justify-center gap-2 rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark"
              >
                Join a batch
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Link>
              <BookCallButton
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:bg-cream-dim"
              >
                <CalendarClock className="h-4 w-4 text-red" />
                Book a consultation
              </BookCallButton>
              <a
                href={CONTACT_INFO.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp {CONTACT_INFO.whatsappDisplay}
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
