import Image from "next/image";
import Reveal from "@/components/Reveal";

export default function FounderIntro() {
  return (
    <section id="about" className="relative overflow-hidden bg-white py-24 lg:py-28">
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-soft/40 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2 lg:gap-20 lg:px-10">
        <Reveal variant="left" className="order-2 lg:order-1">
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-2.5 rounded-2xl bg-gradient-to-br from-navy via-blue to-navy-light opacity-90" />
            <div className="relative rounded-xl border-4 border-double border-navy/15 bg-white p-3 shadow-xl shadow-navy/10">
              <div className="relative w-full overflow-hidden rounded-md">
                <Image
                  src="/images/hitesh-tef-certificate.jpg"
                  alt="Hitesh Angrish's official TEF Canada Attestation de Résultats"
                  width={1179}
                  height={1254}
                  className="h-auto w-full"
                />
              </div>
            </div>

            <div className="absolute -top-4 -right-4 flex h-16 w-16 items-center justify-center rounded-full bg-red text-center shadow-lg shadow-red/40 sm:-top-5 sm:-right-5 sm:h-20 sm:w-20">
              <span className="font-display text-xs font-bold leading-tight text-white sm:text-sm">
                TEF
                <br />
                C1
              </span>
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
                Every class at AngrishFrançais is built around clarity and
                consistency — breaking down grammar and vocabulary into
                lessons that are easy to follow and apply, with a steady
                focus on what the TEF and TCF exams actually test.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
