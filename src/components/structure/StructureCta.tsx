import Link from "next/link";
import Reveal from "@/components/Reveal";

export default function StructureCta() {
  return (
    <section className="bg-cream px-6 py-16 lg:px-10 lg:py-20">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-navy px-8 py-16 text-center shadow-2xl shadow-navy/20 sm:px-16 lg:py-20">
          <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-blue/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-red/20 blur-3xl" />

          <div className="relative">
            <Reveal delayMs={60}>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Ready to Begin Your French Journey?
              </h2>
            </Reveal>

            <Reveal delayMs={140}>
              <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
                Start with the right level and progress through a structured
                path toward practical French and exam preparation.
              </p>
            </Reveal>

            <Reveal delayMs={220}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center rounded-full bg-red px-7 py-3.5 text-sm font-semibold text-white shadow-md shadow-red/40 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-lg"
                >
                  Join a Batch
                </Link>
                <Link
                  href="/#why-us"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 bg-transparent px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
                >
                  View Courses
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
