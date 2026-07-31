"use client";

import { useMemo, useState, useTransition } from "react";
import type { PricingRow } from "@/types/database";
import { updatePricing } from "@/app/admin/(dashboard)/courses/actions";
import { useToast } from "@/components/admin/ToastProvider";

type ModeState = {
  basePrice: string;
  taxRate: string;
  displayTotal: string;
  durationLabel: string;
};

function toModeState(row: PricingRow | undefined): ModeState {
  return {
    basePrice: row ? String(row.base_price) : "0",
    taxRate: row ? String(Math.round(Number(row.tax_rate) * 10000) / 100) : "13",
    displayTotal: row ? String(row.display_total) : "0",
    durationLabel: row?.duration_label ?? "",
  };
}

function suggestedTotal(basePrice: string, taxRatePercent: string) {
  const base = Number(basePrice);
  const tax = Number(taxRatePercent);
  if (Number.isNaN(base) || Number.isNaN(tax)) return null;
  return Math.round(base * (1 + tax / 100) * 100) / 100;
}

function ModeFields({
  label,
  state,
  onChange,
  showDuration,
}: {
  label: string;
  state: ModeState;
  onChange: (next: ModeState) => void;
  showDuration: boolean;
}) {
  const suggestion = suggestedTotal(state.basePrice, state.taxRate);

  return (
    <div className="rounded-xl border border-navy/10 bg-cream-dim/50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-navy/50">{label}</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Base Price (CAD)
          </label>
          <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-2.5 py-2">
            <span className="text-xs text-navy/40">C$</span>
            <input
              type="number"
              step="0.01"
              value={state.basePrice}
              onChange={(e) => onChange({ ...state, basePrice: e.target.value })}
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
              value={state.taxRate}
              onChange={(e) => onChange({ ...state, taxRate: e.target.value })}
              className="w-full text-sm text-navy outline-none"
            />
            <span className="text-xs text-navy/40">%</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
          Total
        </label>
        <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-navy/15 bg-white px-2.5 py-2">
          <span className="text-xs text-navy/40">C$</span>
          <input
            type="number"
            step="0.01"
            value={state.displayTotal}
            onChange={(e) => onChange({ ...state, displayTotal: e.target.value })}
            className="w-full text-sm text-navy outline-none"
          />
        </div>
        {suggestion != null && Math.abs(suggestion - Number(state.displayTotal)) > 0.005 ? (
          <button
            type="button"
            onClick={() => onChange({ ...state, displayTotal: String(suggestion) })}
            className="mt-1 text-[11px] font-semibold text-red hover:underline"
          >
            Use calculated total (C${suggestion.toFixed(2)})
          </button>
        ) : null}
      </div>

      {showDuration ? (
        <div className="mt-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Duration Label
          </label>
          <input
            type="text"
            value={state.durationLabel}
            onChange={(e) => onChange({ ...state, durationLabel: e.target.value })}
            placeholder="e.g. 3 Months"
            className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-2.5 py-2 text-sm text-navy outline-none"
          />
        </div>
      ) : null}
    </div>
  );
}

export default function PricingEditor({
  fullRow,
  monthlyRow,
}: {
  fullRow?: PricingRow;
  monthlyRow?: PricingRow;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [full, setFull] = useState<ModeState>(() => toModeState(fullRow));
  const [monthly, setMonthly] = useState<ModeState>(() => toModeState(monthlyRow));

  const canSave = useMemo(() => Boolean(fullRow && monthlyRow), [fullRow, monthlyRow]);

  const handleSave = () => {
    if (!fullRow || !monthlyRow) return;
    startTransition(async () => {
      const [fullResult, monthlyResult] = await Promise.all([
        updatePricing(fullRow.id, {
          basePrice: Number(full.basePrice),
          taxRate: Number(full.taxRate) / 100,
          displayTotal: Number(full.displayTotal),
          durationLabel: full.durationLabel,
        }),
        updatePricing(monthlyRow.id, {
          basePrice: Number(monthly.basePrice),
          taxRate: Number(monthly.taxRate) / 100,
          displayTotal: Number(monthly.displayTotal),
          durationLabel: monthly.durationLabel,
        }),
      ]);

      if (fullResult.ok && monthlyResult.ok) {
        showToast("Changes saved successfully.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/50">Pricing</p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ModeFields label="Full Phase" state={full} onChange={setFull} showDuration />
        <ModeFields label="Monthly" state={monthly} onChange={setMonthly} showDuration={false} />
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={pending || !canSave}
        className="mt-3 rounded-full bg-navy px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Pricing"}
      </button>
    </div>
  );
}
