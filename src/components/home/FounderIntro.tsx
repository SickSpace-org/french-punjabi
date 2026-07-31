import Image from "next/image";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";

export default function FounderIntro() {
  return (
    <section id="about" className="relative overflow-hidden bg-white py-24 lg:py-28">
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-soft/40 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2 lg:gap-20 lg:px-10">
        <Reveal variant="left" className="order-2 lg:order-1">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
            <div className="absolute -inset-3 rounded-[2rem] bg-blue-soft" />
            <div className="laminate relative h-full w-full rounded-[1.75rem] p-3">
              <div className="relative h-full w-full overflow-hidden rounded-[1.25rem]">
                <Image
                  src="/images/founder-hitesh.jpg"
                  alt="Hitesh Angrish, French trainer"
                  fill
                  priority
                  sizes="(min-width: 1024px) 384px, 90vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </Reveal>

        <div className="order-1 lg:order-2">
          <Reveal delayMs={80}>
            <span className="inline-flex items-center rounded-full bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red">
              Meet Your Mentor
            </span>
          </Reveal>

          <Reveal delayMs={160}>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Hitesh Angrish
            </h2>
          </Reveal>

          <Reveal delayMs={240}>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-navy/70">
              <p>
                Hitesh Angrish teaches French through structured lessons,
                practical explanations, and exam-focused preparation designed
                to help students build real, usable skills.
              </p>
              <p>
                Every class at French Punjabi is built around clarity and
                consistency — breaking down grammar and vocabulary into
                lessons that are easy to follow and apply, with a steady
                focus on what the TEF and TCF exams actually test.
              </p>
              <p className="text-sm text-navy/45 italic">
                [ Editable placeholder — replace with Hitesh&apos;s full
                biography when ready. ]
              </p>
            </div>
          </Reveal>

          <Reveal delayMs={320}>
            <a
              href="#about"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-navy/15 bg-cream px-6 py-3 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-navy/25 hover:shadow-md"
            >
              Learn More About Hitesh
              <ArrowRight className="h-4 w-4" />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
