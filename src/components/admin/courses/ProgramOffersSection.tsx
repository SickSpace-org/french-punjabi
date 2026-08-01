"use client";

import { useState, useTransition } from "react";
import type { ProgramOfferRow } from "@/types/database";
import { updateProgramOffer } from "@/app/admin/(dashboard)/courses/actions";
import { useToast } from "@/components/admin/ToastProvider";

function OfferCard({ offer }: { offer: ProgramOfferRow }) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(offer.label);
  const [basePrice, setBasePrice] = useState(String(offer.base_price));
  const [taxRate, setTaxRate] = useState(
    offer.tax_rate != null ? String(Math.round(Number(offer.tax_rate) * 10000) / 100) : "13"
  );
  const [displayTotal, setDisplayTotal] = useState(
    offer.display_total != null ? String(offer.display_total) : ""
  );
  const [durationLabel, setDurationLabel] = useState(offer.duration_label ?? "");

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateProgramOffer(offer.id, {
        label,
        basePrice: Number(basePrice),
        taxRate: Number(taxRate) / 100,
        displayTotal: Number(displayTotal || 0),
        durationLabel,
      });
      if (result.ok) {
        showToast("Changes saved successfully.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/50">
        {offer.key === "complete_program" ? "Complete Program" : "Redo a Month"}
      </p>

      <div className="mt-3">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
          Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-2.5 py-2 text-sm text-navy outline-none"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Base Price (CAD)
          </label>
          <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-2.5 py-2">
            <span className="text-xs text-navy/40">C$</span>
            <input
              type="number"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="w-full text-sm text-navy outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Tax
          </label>
          <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-2.5 py-2">
            <input
              type="number"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full text-sm text-navy outline-none"
            />
            <span className="text-xs text-navy/40">%</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Total
          </label>
          <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-2.5 py-2">
            <span className="text-xs text-navy/40">C$</span>
            <input
              type="number"
              step="0.01"
              value={displayTotal}
              onChange={(e) => setDisplayTotal(e.target.value)}
              className="w-full text-sm text-navy outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Duration (optional)
          </label>
          <input
            type="text"
            value={durationLabel}
            onChange={(e) => setDurationLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-2.5 py-2 text-sm text-navy outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="mt-4 rounded-full bg-navy px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

export default function ProgramOffersSection({ offers }: { offers: ProgramOfferRow[] }) {
  if (offers.length === 0) return null;

  return (
    <section className="rounded-2xl border border-navy/10 bg-cream-dim/40 p-5">
      <h2 className="font-display text-lg font-bold text-navy">Other Pricing</h2>
      <p className="mt-1 text-sm text-navy/60">
        Program-wide fees not tied to a single phase.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </section>
  );
}
