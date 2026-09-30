import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ProgramOffer } from "@/lib/courses/types";

type OfferHeroProps = {
  eyebrow: string;
  title: string;
  tagline: string;
  offer: ProgramOffer;
  /** Shown right after the base price, e.g. "/month" or "/hr". */
  priceSuffix?: string;
  /** Short facts under the price, e.g. ["7 months", "3 phases"]. */
  facts: string[];
  /** The enroll/book button inside the price card. */
  cta: React.ReactNode;
  ctaNote?: string;
};

export default function OfferHero({
  eyebrow,
  title,
  tagline,
  offer,
  priceSuffix,
  facts,
  cta,
  ctaNote,
}: OfferHeroProps) {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-red/25 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-10 lg:pb-24 lg:pt-14">
        <div>
          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All courses
          </Link>
          <p className="program-rise mt-8 text-sm font-medium text-white/60">{eyebrow}</p>
          <h1 className="program-rise mt-2 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl [animation-delay:80ms]">
            {title}
          </h1>
          <p className="program-rise mt-5 max-w-lg text-lg leading-relaxed text-white/70 [animation-delay:160ms]">
            {tagline}
          </p>
        </div>

        <div className="program-rise rounded-3xl bg-white p-7 text-navy shadow-2xl shadow-black/30 sm:p-8 [animation-delay:200ms]">
          <p className="text-sm text-navy/50">{offer.label}</p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-5xl font-semibold tracking-tight">
              ${offer.base}
              {priceSuffix ? <span className="text-2xl text-navy/60">{priceSuffix}</span> : null}
            </span>
          </p>

          {facts.length ? (
            <ul className="mt-6 flex flex-wrap gap-2 text-sm">
              {facts.map((fact) => (
                <li key={fact} className="rounded-full bg-cream-dim px-3 py-1 text-navy/70">
                  {fact}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-7">{cta}</div>
          {ctaNote ? <p className="mt-3 text-center text-xs text-navy/45">{ctaNote}</p> : null}
        </div>
      </div>
    </section>
  );
}
