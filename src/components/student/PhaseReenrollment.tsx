"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Clock3 } from "lucide-react";
import { getReenrollmentOptions, createPhaseReenrollmentCheckout, type ReenrollBatchOption } from "@/lib/payments/phaseReenrollmentCheckout";

export default function PhaseReenrollment() {
  const [batches, setBatches] = useState<ReenrollBatchOption[] | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  // "too_early" just means "not yet" — nothing is wrong with the
  // account, so it gets a neutral tone, not the red problem-styling the
  // other blocked reasons (suspended/payment_trouble/deactivated) use.
  const [tooEarly, setTooEarly] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<"full" | "monthly">("monthly");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getReenrollmentOptions().then((result) => {
      if (result.ok) {
        setBatches(result.batches);
      } else if (result.blockedReason === "too_early") {
        setTooEarly(true);
        setBlockedMessage(result.error);
      } else if (result.blockedReason) {
        // A real payment problem (suspended, past-due, deactivated) —
        // tell the student why, rather than silently hiding this section
        // and leaving them wondering if the feature exists at all.
        setBlockedMessage(result.error);
      }
      // Any other failure (not signed in, etc.) — section just stays
      // hidden; not this component's job to explain an auth problem.
    });
  }, []);

  if (blockedMessage) {
    return tooEarly ? (
      <div className="mt-6 max-w-lg rounded-2xl border border-navy/10 bg-cream-dim/60 p-6">
        <div className="flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-navy/50" strokeWidth={2} />
          <h2 className="font-display text-base font-bold text-navy">Enroll in Your Next Phase</h2>
        </div>
        <p className="mt-2 text-sm text-navy/70">{blockedMessage}</p>
      </div>
    ) : (
      <div className="mt-6 max-w-lg rounded-2xl border border-red/20 bg-red-soft/40 p-6">
        <h2 className="font-display text-base font-bold text-navy">Enroll in Your Next Phase</h2>
        <p className="mt-2 text-sm text-red-dark">{blockedMessage}</p>
      </div>
    );
  }

  if (!batches || batches.length === 0) return null;

  const handleEnroll = async () => {
    if (!selectedBatchId) return;
    setPending(true);
    setError(null);
    const result = await createPhaseReenrollmentCheckout(selectedBatchId, paymentMode);
    if (result.ok) {
      window.location.href = result.redirectUrl;
      return;
    }
    setError(result.error);
    setPending(false);
  };

  return (
    <div className="mt-6 max-w-lg rounded-2xl border border-navy/10 bg-white p-6">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-red" strokeWidth={2} />
        <h2 className="font-display text-base font-bold text-navy">Enroll in Your Next Phase</h2>
      </div>
      <p className="mt-1 text-sm text-navy/60">
        Pick a batch and payment option — you&apos;ll see today&apos;s price for that phase on the Stripe payment page
        before anything is charged. No free trial on a new phase.
      </p>

      <div className="mt-4 space-y-2">
        {batches.map((b) => (
          <button
            key={b.id}
            type="button"
            disabled={b.disabled || pending}
            onClick={() => setSelectedBatchId(b.id)}
            className={`block w-full rounded-xl border px-4 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              selectedBatchId === b.id ? "border-red bg-red-soft/40 font-semibold text-navy" : "border-navy/15 text-navy hover:border-red/30"
            }`}
          >
            {b.label}
            {b.disabled ? <span className="ml-2 text-xs text-navy/40">Full</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setPaymentMode("monthly")}
          className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold ${
            paymentMode === "monthly" ? "border-red bg-red-soft/40 text-navy" : "border-navy/15 text-navy/60"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setPaymentMode("full")}
          className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold ${
            paymentMode === "full" ? "border-red bg-red-soft/40 text-navy" : "border-navy/15 text-navy/60"
          }`}
        >
          Full Phase
        </button>
      </div>

      <button
        type="button"
        disabled={!selectedBatchId || pending}
        onClick={() => void handleEnroll()}
        className="mt-4 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "Starting checkout…" : "Proceed to Payment"}
      </button>

      {error ? <p className="mt-3 text-sm text-red-dark">{error}</p> : null}
    </div>
  );
}
