import { RotateCcw } from "lucide-react";
import Reveal from "@/components/Reveal";
import type { ProgramOffer } from "@/lib/courses/types";
import type { EnrollSelection } from "./EnrollModal";

type MonthlyRedoNoteProps = {
  offer: ProgramOffer;
  onEnroll: (selection: EnrollSelection) => void;
};

export default function MonthlyRedoNote({ offer, onEnroll }: MonthlyRedoNoteProps) {
  const handleRedoEnroll = () => {
    onEnroll({
      phase: "Redo a Month",
      batch: "Repeat a Program Month",
      timing: "Timing confirmed after enrollment",
      feeLabel: `$${offer.base} + Tax`,
      programOfferKey: "redo_month",
    });
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <button
          type="button"
          onClick={handleRedoEnroll}
          className="group flex w-full flex-col gap-5 rounded-2xl border border-navy/10 bg-white px-6 py-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red/30 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:px-8"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red transition-transform duration-300 group-hover:scale-110">
              <RotateCcw className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="font-display text-base font-bold text-navy">
                Need to Repeat a Month?
              </p>
              <p className="mt-0.5 text-sm text-navy/60">
                Students who want to redo a month can pay on top of the base
                program price. Click to enroll.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-red px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 group-hover:bg-red-dark group-hover:shadow-md">
            {offer.label}
          </span>
        </button>
      </Reveal>
    </div>
  );
}
