"use client";

import { useState } from "react";
import { CreditCard, Repeat } from "lucide-react";
import { payThisMonth, setUpAutopay } from "@/lib/payments/existingStudentCheckout";

function PlanField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">{label}</p>
      <p className="mt-0.5 text-sm text-navy">{value}</p>
    </div>
  );
}

export default function ExistingStudentPaymentOptions({
  planName,
  amount,
  currency,
  nextPaymentDue,
  autopaySetUp,
}: {
  planName: string;
  amount: number;
  currency: string;
  nextPaymentDue: string;
  /** False on this page by construction: an existing student who sets up autopay becomes Stripe-managed and sees the Stripe subscription view instead. */
  autopaySetUp: boolean;
}) {
  const [pending, setPending] = useState<"one_time" | "autopay" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = async (action: () => Promise<{ ok: true; redirectUrl: string } | { ok: false; error: string }>, which: "one_time" | "autopay") => {
    setPending(which);
    setError(null);
    const result = await action();
    if (result.ok) {
      window.location.href = result.redirectUrl;
      return;
    }
    setError(result.error);
    setPending(null);
  };

  return (
    <div className="mt-6 max-w-lg rounded-2xl border border-navy/10 bg-white p-6">
      <h2 className="font-display text-base font-bold text-navy">Your Plan</h2>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <PlanField label="Plan" value={planName} />
        <PlanField label="Monthly Amount" value={`${currency} $${amount.toFixed(2)} / month`} />
        <PlanField label="Next Payment Due" value={nextPaymentDue} />
        <PlanField label="Autopay" value={autopaySetUp ? "On" : "Not set up"} />
      </div>
      <p className="mt-5 text-sm text-navy/60">
        Pay online below. You&apos;ll see this exact amount again on the Stripe payment page before anything is charged.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void handle(payThisMonth, "one_time")}
          className="flex flex-col items-start gap-2 rounded-xl border border-navy/15 bg-white p-4 text-left hover:border-red/30 disabled:opacity-60"
        >
          <CreditCard className="h-5 w-5 text-red" strokeWidth={2} />
          <span className="text-sm font-bold text-navy">{pending === "one_time" ? "Starting checkout…" : "Pay This Month"}</span>
          <span className="text-xs text-navy/50">One-time payment of {currency} ${amount.toFixed(2)}, right now.</span>
        </button>

        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void handle(setUpAutopay, "autopay")}
          className="flex flex-col items-start gap-2 rounded-xl border border-navy/15 bg-white p-4 text-left hover:border-red/30 disabled:opacity-60"
        >
          <Repeat className="h-5 w-5 text-red" strokeWidth={2} />
          <span className="text-sm font-bold text-navy">{pending === "autopay" ? "Starting checkout…" : "Set Up Autopay"}</span>
          <span className="text-xs text-navy/50">
            Saves your card now; your first automatic charge is on {nextPaymentDue}, not today.
          </span>
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-dark">{error}</p> : null}
    </div>
  );
}
