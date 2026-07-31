import Image from "next/image";
import { Award } from "lucide-react";
import Reveal from "@/components/Reveal";

export default function FounderCertificate() {
  return (
    <section className="relative overflow-hidden bg-cream-dim py-24 lg:py-28">
      <div className="pointer-events-none absolute top-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-red-soft/60 blur-3xl" />

      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-10">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red">
            <Award className="h-3.5 w-3.5" strokeWidth={2.4} />
            Certified &amp; Exam-Ready
          </span>
        </Reveal>

        <Reveal delayMs={80}>
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            TEF Canada Result — C1 Level
          </h2>
        </Reveal>

        <Reveal delayMs={160}>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-navy/70">
            Hitesh&apos;s own official Attestation de Résultats from the Test
            d&apos;Évaluation de Français, proof of the exam standard every
            French Punjabi student is trained toward.
          </p>
        </Reveal>

        <Reveal delayMs={240} variant="scale">
          <div className="relative mx-auto mt-10 w-full max-w-md">
            <div className="absolute -inset-2.5 rounded-2xl bg-gradient-to-br from-navy via-blue to-navy-light opacity-90" />
            <div className="relative rounded-xl border-4 border-double border-navy/15 bg-white p-3 shadow-2xl shadow-navy/20">
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
      </div>
    </section>
  );
}
