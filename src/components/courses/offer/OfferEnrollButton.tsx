"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import EnrollModal, { type EnrollSelection } from "../EnrollModal";

type OfferEnrollButtonProps = {
  selection: EnrollSelection;
  label: string;
  tone?: "red" | "white";
};

const TONES = {
  red: "bg-red text-white shadow-md shadow-black/20 hover:bg-red-dark",
  white: "bg-white text-navy hover:shadow-lg",
};

export default function OfferEnrollButton({ selection, label, tone = "red" }: OfferEnrollButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group/btn inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 ${TONES[tone]}`}
      >
        {label}
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
          strokeWidth={2.5}
        />
      </button>
      <EnrollModal selection={open ? selection : null} onClose={() => setOpen(false)} />
    </>
  );
}
