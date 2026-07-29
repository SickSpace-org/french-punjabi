import { CalendarClock, RotateCcw } from "lucide-react";
import Reveal from "@/components/Reveal";
import { MONTHLY_FEE, REDO_MONTH_FEE } from "@/data/fees";
import type { EnrollSelection } from "./EnrollModal";

type MonthlyRedoNoteProps = {
  onEnroll: (selection: EnrollSelection) => void;
};

export default function MonthlyRedoNote({ onEnroll }: MonthlyRedoNoteProps) {
  const handleRedoEnroll = () => {
    onEnroll({
      phase: "Redo a Month",
      batch: "Repeat a Program Month",
      timing: "Timing confirmed after enrollment",
      feeLabel: `$${REDO_MONTH_FEE.base} + Tax`,
    });
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <div className="flex flex-col gap-5 rounded-2xl border border-navy/10 bg-white px-6 py-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red">
              <CalendarClock className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="font-display text-base font-bold text-navy">{MONTHLY_FEE.label}</p>
              <p className="mt-0.5 text-sm text-navy/60">
                Pay month-to-month instead of the full phase fee.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="font-display text-2xl font-bold text-navy">
              ${MONTHLY_FEE.base}
              <span className="ml-1.5 text-xs font-bold uppercase tracking-wide text-red">
                + 13% Tax
              </span>
            </p>
            <p className="mt-0.5 text-xs text-navy/50">
              Total{" "}
              <span className="font-semibold text-red-dark">
                ${MONTHLY_FEE.total.toFixed(2)}
              </span>{" "}
              / month
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delayMs={80}>
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
            {REDO_MONTH_FEE.label}
          </span>
        </button>
      </Reveal>
    </div>
  );
}
