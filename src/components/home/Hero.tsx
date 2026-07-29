import { CalendarRange, Target, Users } from "lucide-react";
import Link from "next/link";
import PlaceholderImage from "@/components/PlaceholderImage";
import Reveal from "@/components/Reveal";

const TRUST_POINTS = [
  { icon: Users, label: "Small Batches" },
  { icon: CalendarRange, label: "Flexible Schedule" },
  { icon: Target, label: "Exam-Focused Training" },
];

export default function Hero() {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-cream pt-16 pb-24 lg:pt-20 lg:pb-32"
    >
      {/* Ambient background accents */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blue-soft blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-32 h-96 w-96 rounded-full bg-red-soft blur-3xl" />

      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2 lg:gap-12 lg:px-10">
        {/* Left column */}
        <div>
          <Reveal>
            <span className="inline-flex items-center rounded-full border border-navy/10 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-navy/70 shadow-sm">
              French Learning • TEF • TCF
            </span>
          </Reveal>

          <Reveal delayMs={80}>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.12] tracking-tight text-navy sm:text-5xl lg:text-[3.4rem]">
              Learn French.
              <br />
              Prepare Smarter.
              <br />
              <span className="text-red">Achieve Your Goals.</span>
            </h1>
          </Reveal>

          <Reveal delayMs={160}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-navy/70">
              Structured French learning and exam-focused TEF/TCF preparation
              with practical guidance, flexible classes, and personal
              attention.
            </p>
          </Reveal>

          <Reveal delayMs={240}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/courses"
                className="inline-flex items-center justify-center rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-lg hover:shadow-red/40"
              >
                Join a Batch
              </Link>
              <a
                href="#why-us"
                className="inline-flex items-center justify-center rounded-full border border-navy/15 bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-navy/25 hover:shadow-md"
              >
                Explore Classes
              </a>
            </div>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TRUST_POINTS.map(({ icon: Icon, label }, index) => (
              <Reveal key={label} variant="scale" delayMs={320 + index * 80}>
                <div className="flex items-center gap-3 rounded-2xl border border-navy/10 bg-white/60 px-4 py-3 shadow-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
                    <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <span className="text-sm font-medium text-navy/80">
                    {label}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Right column */}
        <Reveal variant="right" delayMs={150} className="relative">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-navy via-navy-light to-blue opacity-90" />
            <div className="relative h-full w-full overflow-hidden rounded-[2rem] shadow-2xl shadow-navy/20">
              <PlaceholderImage
                alt="Hitesh Angrish, Founder of French Punjabi"
                label="[ HITESH ANGRISH IMAGE PLACEHOLDER ]"
                helperText="Replace by adding /public/images/founder-hero.jpg and passing src to <Hero />"
                variant="portrait"
                priority
              />
            </div>

            {/* Floating info card */}
            <div className="animate-float absolute -bottom-6 -left-6 w-64 rounded-2xl border border-navy/10 bg-white p-4 shadow-xl shadow-navy/10 sm:-left-10">
              <p className="font-display text-base font-semibold text-navy">
                Hitesh Angrish
              </p>
              <p className="mt-0.5 text-sm text-navy/60">
                Founder &amp; French Trainer
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-red">
                French Punjabi
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
