import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";

export default function SyllabusCta() {
  return (
    <section className="bg-cream-dim px-6 py-16 lg:px-10 lg:py-20">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-red-dark via-red to-red-dark px-8 py-16 text-center shadow-2xl shadow-red-dark/30 sm:px-16 lg:py-20">
          <div className="bg-hairlines pointer-events-none absolute inset-0 opacity-50" />
          <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-navy/30 blur-3xl" />

          <div className="relative">
            <Reveal delayMs={60}>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Ready to Put the Syllabus Into Practice?
              </h2>
            </Reveal>

            <Reveal delayMs={140}>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/80">
                Explore available levels and batch timings to find the right
                place to begin.
              </p>
            </Reveal>

            <Reveal delayMs={220}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/courses"
                  className="group/btn inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-red-dark shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  View Courses
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
                    strokeWidth={2.5}
                  />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20"
                >
                  Contact Us
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
