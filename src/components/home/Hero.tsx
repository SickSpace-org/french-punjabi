import { ArrowRight, BadgeCheck, CalendarClock, ShieldCheck, Star, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import BookCallButton from "@/components/BookCallButton";
import { REVIEWS } from "@/data/results";
import RotatingWord from "./RotatingWord";

const GOAL_WORDS = ["Canada PR.", "Citizenship.", "Québec.", "your career."];

const EXAM_TICKER = [
  "TEF Canada",
  "TCF Canada",
  "Express Entry",
  "Canadian Citizenship",
  "Québec Immigration",
  "Francophone Mobility",
  "Speaking",
  "Writing",
  "Listening",
  "Reading",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

const AVATAR_TONES = ["bg-red text-white", "bg-navy text-white", "bg-blue-soft text-blue", "bg-white text-navy"];

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden bg-cream">
      {/* Slow drifting colour fields + faint grid for depth */}
      <div className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="hero-blob pointer-events-none absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-blue-soft blur-3xl" />
      <div className="hero-blob pointer-events-none absolute -right-24 top-24 h-[30rem] w-[30rem] rounded-full bg-red-soft blur-3xl [animation-delay:-7s]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 pb-20 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-10 lg:pb-28 lg:pt-16">
        {/* Copy */}
        <div>
          <p className="program-rise inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white/80 py-1.5 pl-2 pr-4 text-xs font-semibold text-navy/75 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            New batches enrolling · TEF &amp; TCF Canada
          </p>

          <h1 className="program-rise mt-6 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-navy [animation-delay:80ms] sm:text-6xl lg:text-[4.1rem]">
            Learn French for
            <br />
            <RotatingWord words={GOAL_WORDS} className="italic text-red" />
          </h1>

          <p className="program-rise mt-6 max-w-xl text-lg leading-relaxed text-navy/70 [animation-delay:160ms]">
            A structured 7-month program that takes you from your first French word to
            exam day, taught in small batches by a TEF&nbsp;C1-certified trainer who has
            sat the exam himself.
          </p>

          <div className="program-rise mt-9 flex flex-wrap items-center gap-3 [animation-delay:240ms]">
            <Link
              href="/courses"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-xl hover:shadow-red/40"
            >
              See upcoming batches
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <BookCallButton
              className="inline-flex items-center justify-center gap-2 rounded-full border border-navy/15 bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-navy/25 hover:shadow-md"
            >
              <CalendarClock className="h-4 w-4 text-red" />
              Book a consultation
            </BookCallButton>
          </div>

          {/* Social proof */}
          <div className="program-rise mt-10 flex flex-wrap items-center gap-x-5 gap-y-3 [animation-delay:320ms]">
            <div className="flex -space-x-2.5">
              {REVIEWS.map((review, i) => (
                <span
                  key={review.id}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ring-[3px] ring-cream ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
                  aria-hidden="true"
                >
                  {initials(review.name)}
                </span>
              ))}
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-dim text-[11px] font-bold text-navy/70 ring-[3px] ring-cream">
                +100
              </span>
            </div>
            <div>
              <div className="flex items-center gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" strokeWidth={1.5} />
                ))}
              </div>
              <p className="mt-0.5 text-sm text-navy/65">
                <span className="font-semibold text-navy">100+ students</span> trained for TEF &amp; TCF
              </p>
            </div>
          </div>
        </div>

        {/* Visual */}
        <div className="program-rise relative mx-auto w-full max-w-md [animation-delay:200ms]">
          <div className="relative aspect-[4/5]">
            <div className="absolute -inset-3 rotate-[3deg] rounded-[2.5rem] bg-gradient-to-br from-navy via-navy-light to-red opacity-95" />
            <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-white p-2.5 shadow-2xl shadow-navy/25">
              <div className="relative h-full w-full overflow-hidden rounded-[1.6rem]">
                <Image
                  src="/images/founder-hitesh.jpg"
                  alt="Hitesh Angrish, founder of AngrishFrançais"
                  fill
                  priority
                  sizes="(min-width: 1024px) 448px, 90vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-navy/70 to-transparent" />
                <div className="absolute bottom-4 left-5 text-white">
                  <p className="font-display text-lg font-semibold">Hitesh Angrish</p>
                  <p className="text-sm text-white/80">Founder &amp; lead trainer</p>
                </div>
              </div>
            </div>

            {/* Floating proof cards */}
            <div className="animate-float absolute -right-4 top-8 flex items-center gap-3 rounded-2xl border border-navy/10 bg-white/95 p-3 pr-4 shadow-xl shadow-navy/15 backdrop-blur sm:-right-10">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red text-white">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-navy">TEF Canada C1</p>
                <p className="text-xs text-navy/55">Certified trainer</p>
              </div>
            </div>

            <div className="animate-float absolute -left-4 top-1/2 flex items-center gap-3 rounded-2xl border border-navy/10 bg-white/95 p-3 pr-4 shadow-xl shadow-navy/15 backdrop-blur [animation-delay:-2s] sm:-left-12">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-soft text-blue">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-navy">9–10 per batch</p>
                <p className="text-xs text-navy/55">Personal attention</p>
              </div>
            </div>

            <div className="animate-float absolute -bottom-6 right-4 flex items-center gap-3 rounded-2xl bg-navy p-3 pr-4 text-white shadow-xl shadow-navy/30 [animation-delay:-4s]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">7-day full refund</p>
                <p className="text-xs text-white/65">If it isn&apos;t for you</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What we prepare you for */}
      <div className="relative border-y border-navy/8 bg-white/70 py-4 backdrop-blur">
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="animate-marquee-right flex w-max items-center gap-10 [animation-duration:55s]">
            {[...EXAM_TICKER, ...EXAM_TICKER].map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="flex items-center gap-10 whitespace-nowrap text-sm font-semibold uppercase tracking-[0.18em] text-navy/45"
              >
                {item}
                <span className="h-1.5 w-1.5 rounded-full bg-red/40" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
