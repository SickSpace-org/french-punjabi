import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, MessageCircle, MessageSquareText, Timer, TrendingUp } from "lucide-react";
import Reveal from "@/components/Reveal";
import { CONTACT_INFO } from "@/data/contact";
import BookCallButton from "@/components/BookCallButton";

const STEPS = [
  { icon: ClipboardCheck, when: "Every week", title: "Quick checks", body: "Grammar, vocabulary and pronunciation quizzes plus mini speaking tasks." },
  { icon: TrendingUp, when: "Every month", title: "Full evaluation", body: "Writing, speaking, listening and reading, each marked with feedback." },
  { icon: Timer, when: "Months 6–7", title: "Timed mock tests", body: "Real exam conditions, so exam day feels familiar." },
  { icon: MessageSquareText, when: "Always", title: "Personal feedback", body: "Corrections on your own speaking and writing, not generic notes." },
];

/** What students went through to earn those results, then the closing call to action. */
export default function ResultsPath() {
  return (
    <>
      <section className="bg-cream-dim py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">Behind every result</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
              Scores like these don&apos;t happen by luck.
            </h2>
            <p className="mt-4 text-lg text-navy/65">
              Every student follows the same rhythm of practice and feedback, so nothing on
              exam day comes as a surprise.
            </p>
          </Reveal>

          <ol className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, when, title, body }, i) => (
              <li key={title} className="h-full">
                <Reveal variant="up" delayMs={i * 120} className="h-full">
                  <div className="group relative h-full rounded-3xl bg-white p-6 shadow-sm ring-1 ring-navy/8 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-navy/10">
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-white transition-all duration-500 group-hover:rotate-[-6deg] group-hover:bg-red">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="font-display text-4xl font-bold text-navy/8">0{i + 1}</span>
                    </div>
                    <p className="mt-5 text-sm font-semibold text-red">{when}</p>
                    <h3 className="mt-1 font-display text-xl font-semibold text-navy">{title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-navy/65">{body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-cream-dim px-6 pb-20 lg:px-10 lg:pb-28">
        <Reveal variant="scale">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-navy px-8 py-16 text-center shadow-2xl shadow-navy/25 sm:px-16 lg:py-20">
            <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
            <div className="hero-blob pointer-events-none absolute -left-20 -top-24 h-80 w-80 rounded-full bg-blue/40 blur-3xl" />
            <div className="hero-blob pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-red/40 blur-3xl [animation-delay:-6s]" />

            <div className="relative">
              <h2 className="mx-auto max-w-3xl font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Your certificate could be <span className="italic text-blue-soft/90">next.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
                Join a batch and try the classes for 7 days. If it isn&apos;t for you, get a full refund.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/courses"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark"
                >
                  See upcoming batches
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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
                  Ask on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
