import Link from "next/link";
import { ArrowRight, RotateCcw, UserRound } from "lucide-react";
import Reveal from "@/components/Reveal";
import type { Phase, ProgramOffers } from "@/lib/courses/types";
import { OFFER_HREF, perDuration } from "@/data/offerDetails";

type OfferCardsProps = {
  phases: Phase[];
  programOffers: ProgramOffers;
};

const CARD_LINK =
  "group relative flex w-full flex-col overflow-hidden rounded-3xl outline-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-4 focus-visible:ring-offset-cream";

function ArrowPill({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-500 group-hover:w-24 group-hover:bg-red group-hover:text-white ${
        light ? "bg-white text-navy" : "bg-navy text-white"
      }`}
    >
      <span className="sr-only">{label}</span>
      <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-5" strokeWidth={2.5} />
    </span>
  );
}

/** The complete program and the two extras, each linking to its own page. */
export default function OfferCards({ phases, programOffers }: OfferCardsProps) {
  const { complete_program: complete, redo_month: redo, one_on_one_testing: oneOnOne } = programOffers;
  if (!complete && !redo && !oneOnOne) return null;

  const perPhaseTotal = phases.reduce((sum, p) => sum + p.pricing.full.base, 0);
  const saving = complete ? perPhaseTotal - complete.base : 0;

  return (
    <div className="mt-20">
      <Reveal>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-navy">More ways to study</h2>
        <p className="mt-3 max-w-2xl text-lg text-navy/65">
          Take the whole program in one go, go over a month again, or book a private test.
        </p>
      </Reveal>

      {complete ? (
        <Reveal className="mt-10">
          <Link
            href={OFFER_HREF.complete_program}
            className={`${CARD_LINK} bg-navy text-white shadow-xl shadow-navy/20 hover:shadow-2xl hover:shadow-navy/30`}
          >
            <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-red/25 blur-3xl transition-transform duration-700 group-hover:scale-125" />

            <div className="relative grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div>
                <p className="flex flex-wrap items-center gap-3 text-sm text-white/60">
                  Complete program
                  {saving > 0 ? (
                    <span className="rounded-full bg-red px-2.5 py-0.5 text-xs font-semibold text-white">
                      Save ${saving}
                    </span>
                  ) : null}
                </p>
                <h3 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  All three phases, {complete.duration?.toLowerCase() ?? "seven months"}.
                </h3>
                <p className="mt-3 max-w-md leading-relaxed text-white/70">
                  From your first French word to TEF/TCF exam day, in one enrollment.
                </p>
              </div>

              <div>
                <ol className="flex items-center">
                  {phases.map((phase, i) => (
                    <li key={phase.id} className="flex flex-1 items-center last:flex-none">
                      <span className="flex flex-col items-center gap-2 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-display font-semibold ring-1 ring-white/20 transition-colors duration-500 group-hover:bg-white group-hover:text-navy"
                          style={{ transitionDelay: `${i * 120}ms` }}
                        >
                          {i + 1}
                        </span>
                        <span className="max-w-24 text-xs text-white/60">{phase.title}</span>
                      </span>
                      {i < phases.length - 1 ? (
                        <span className="mx-2 mb-6 h-px flex-1 bg-white/20" />
                      ) : null}
                    </li>
                  ))}
                </ol>

                <div className="mt-8 flex items-end justify-between gap-4 border-t border-white/15 pt-5">
                  <p>
                    <span className="font-display text-3xl font-semibold">${complete.base}</span>
                    <span className="text-white/60"> paid once</span>
                  </p>
                  <ArrowPill label="See the complete program" light />
                </div>
              </div>
            </div>
          </Link>
        </Reveal>
      ) : null}

      {redo || oneOnOne ? (
        <ul className="mt-5 grid gap-5 md:grid-cols-2">
          {redo ? (
            <li className="flex">
              <Reveal delayMs={80} className="flex w-full">
                <Link
                  href={OFFER_HREF.redo_month}
                  className={`${CARD_LINK} border border-navy/10 bg-white p-7 shadow-sm hover:shadow-2xl hover:shadow-navy/15`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-soft text-red transition-transform duration-500 group-hover:-rotate-45">
                    <RotateCcw className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight text-navy">
                    Repeat a month
                  </h3>
                  <p className="mt-2 mb-7 leading-relaxed text-navy/65">
                    Missed classes or not ready to move on? Take any of the seven months again.
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-4 border-t border-navy/10 pt-5">
                    <p className="font-semibold text-navy">
                      ${redo.base}
                      <span className="font-normal text-navy/50">/month</span>
                    </p>
                    <ArrowPill label="About repeating a month" />
                  </div>
                </Link>
              </Reveal>
            </li>
          ) : null}

          {oneOnOne ? (
            <li className="flex">
              <Reveal delayMs={160} className="flex w-full">
                <Link
                  href={OFFER_HREF.one_on_one_testing}
                  className={`${CARD_LINK} border border-navy/10 bg-white p-7 shadow-sm hover:shadow-2xl hover:shadow-navy/15`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-soft text-navy transition-transform duration-500 group-hover:scale-110">
                    <UserRound className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight text-navy">
                    {oneOnOne.label}
                  </h3>
                  <p className="mt-2 mb-7 leading-relaxed text-navy/65">
                    A private session with a teacher, focused on whatever you need most.
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-4 border-t border-navy/10 pt-5">
                    <p className="font-semibold text-navy">
                      ${oneOnOne.base}
                      {perDuration(oneOnOne.duration)}
                    </p>
                    <ArrowPill label={`About ${oneOnOne.label}`} />
                  </div>
                </Link>
              </Reveal>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
