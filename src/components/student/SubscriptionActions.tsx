"use client";

import { useState } from "react";
import { CreditCard, Loader2, XCircle } from "lucide-react";
import { createOwnPortalSession } from "@/lib/payments/portalActions";

/**
 * Both buttons open the SAME Stripe Customer Portal session — Stripe's
 * hosted page is what actually shows "Update payment method" / "Cancel
 * subscription" (and "Renew subscription" automatically once a
 * subscription is already set to cancel_at_period_end). This app never
 * builds its own card form — no card data ever touches our servers.
 */
export default function SubscriptionActions() {
  const [pending, setPending] = useState<"card" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async (which: "card" | "cancel") => {
    setPending(which);
    setError(null);
    const result = await createOwnPortalSession();
    if (result.ok) {
      window.location.href = result.redirectUrl;
      return;
    }
    setError("Couldn't open the billing portal. Please try again or contact support.");
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={() => openPortal("card")}
        disabled={pending !== null}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim disabled:opacity-60"
      >
        {pending === "card" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" strokeWidth={2} />}
        Update Card
      </button>
      <button
        type="button"
        onClick={() => openPortal("cancel")}
        disabled={pending !== null}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red/20 bg-white px-5 py-2.5 text-sm font-semibold text-red-dark transition-colors hover:bg-red-soft/50 disabled:opacity-60"
      >
        {pending === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" strokeWidth={2} />}
        Cancel Subscription
      </button>
      {error ? <p className="text-sm font-medium text-red">{error}</p> : null}
    </div>
  );
}
