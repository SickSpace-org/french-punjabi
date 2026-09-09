import { ArrowRight, Users } from "lucide-react";
import Reveal from "@/components/Reveal";
import type { ProgramOffer } from "@/lib/courses/types";
import type { EnrollSelection } from "./EnrollModal";

type OneOnOneTestingCardProps = {
  offer: ProgramOffer;
  onEnroll: (selection: EnrollSelection) => void;
};

export default function OneOnOneTestingCard({ offer, onEnroll }: OneOnOneTestingCardProps) {
  const handleEnroll = () => {
    onEnroll({
      phase: "1-on-1 Testing",
      batch: offer.duration ? `1-on-1 Testing Session (${offer.duration})` : "1-on-1 Testing Session",
      timing: "Timing confirmed after enrollment",
      feeLabel: `$${offer.base} + Tax`,
      totalLabel: offer.total != null ? `$${offer.total.toFixed(2)} Total` : undefined,
      programOfferKey: "one_on_one_testing",
    });
  };

  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-2xl border border-navy/10 bg-white px-6 py-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red/30 hover:shadow-md sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red-dark">
              <Users className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="font-display text-base font-bold text-navy">{offer.label}</p>
              <p className="mt-0.5 text-sm text-navy/60">
                <span className="font-semibold text-navy">${offer.base}</span> + Tax
                {offer.total != null ? (
                  <>
                    {" "}
                    · Total <span className="font-semibold text-navy">${offer.total.toFixed(2)}</span>
                  </>
                ) : null}
                {offer.duration ? <> · {offer.duration}</> : null}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEnroll}
            className="group/btn inline-flex items-center justify-center gap-2 rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-md"
          >
            Book a Session
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
              strokeWidth={2.5}
            />
          </button>
        </div>
      </div>
    </Reveal>
  );
}
