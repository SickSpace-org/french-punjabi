import Link from "next/link";
import { Plus } from "lucide-react";
import Reveal from "@/components/Reveal";
import { CONTACT_INFO } from "@/data/contact";

const FAQS = [
  {
    q: "I've never studied French. Can I still join?",
    a: "Yes. Phase 1 is built for complete beginners as well as students who already know some basic conjugation. You start with pronunciation, the alphabet and simple sentences.",
  },
  {
    q: "How long does it take to be exam-ready?",
    a: "The full program runs for 7 months across 3 phases: Foundation (months 1–3), Application (months 4–5) and Exam Preparation (months 6–7). If you already have a B1 base, you can join directly at a later phase.",
  },
  {
    q: "Should I prepare for TEF or TCF?",
    a: "Both are accepted by Canada. Phases 1 and 2 are shared; in Phase 3 you pick your track, with Level 1 for TEF Canada and Level 2 for TCF Canada. We can help you choose on a consultation call.",
  },
  {
    q: "What if I miss classes?",
    a: "Recorded classes are available, and if you miss a large part of a month you can repeat that month instead of moving on with gaps.",
  },
  {
    q: "What if the classes aren't right for me?",
    a: "Attend classes for 7 days. If you're not satisfied, you get a full refund according to the program terms.",
  },
  {
    q: "Do you give immigration advice?",
    a: "No. We teach French and prepare you for the exam. For your immigration file, please work with a licensed consultant.",
  },
];

export default function HomeFaq() {
  return (
    <section id="faq" className="bg-white py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-10">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">Questions</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
            Before you enroll.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-navy/65">
            Still unsure? Message us on WhatsApp and a real person will answer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={CONTACT_INFO.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-navy-light"
            >
              Ask on WhatsApp
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-full border border-navy/15 px-6 py-3 text-sm font-semibold text-navy transition-all hover:-translate-y-0.5 hover:border-navy/30"
            >
              Other ways to reach us
            </Link>
          </div>
        </Reveal>

        <div className="divide-y divide-navy/10 border-y border-navy/10">
          {FAQS.map((item, i) => (
            <Reveal key={item.q} variant="fade" delayMs={i * 70}>
              <details className="faq group py-2" name="home-faq">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-left font-display text-lg font-semibold text-navy transition-colors hover:text-red [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-navy transition-all duration-300 group-open:rotate-45 group-open:bg-red group-open:text-white">
                    <Plus className="h-4 w-4" />
                  </span>
                </summary>
                <div className="faq-body">
                  <p className="pb-5 pr-12 leading-relaxed text-navy/65">{item.a}</p>
                </div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
