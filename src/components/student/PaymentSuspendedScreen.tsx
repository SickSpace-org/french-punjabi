"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldAlert, CreditCard, Loader2 } from "lucide-react";
import { createOwnPortalSession } from "@/lib/payments/portalActions";
import { checkOwnStatus } from "@/lib/payments/checkOwnStatus";
import StudentLogoutButton from "@/components/student/StudentLogoutButton";

/**
 * B2's payment-failure SUSPENDED screen — distinct from the generic
 * admin-suspend block in layout.tsx (that one has no payment button;
 * this one is only shown when the student has a Stripe subscription).
 *
 * `variant` is the ONE thing to change to switch between a full-page
 * takeover and a dismissable-feeling overlay on top of the normal portal
 * — same content and behavior either way, only the backdrop/sizing CSS
 * differs, so toggling is a one-line prop change in layout.tsx.
 */
export default function PaymentSuspendedScreen({ variant }: { variant: "fullpage" | "overlay" }) {
  const searchParams = useSearchParams();
  const [activating] = useState(searchParams.get("from") === "portal");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activating) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const result = await checkOwnStatus();
      if (result?.status === "ACTIVE" || attempts >= 10) {
        clearInterval(interval);
        window.location.href = window.location.pathname;
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activating]);

  const handlePay = async () => {
    setPending(true);
    setError(null);
    const result = await createOwnPortalSession();
    if (result.ok) {
      window.location.href = result.redirectUrl;
      return;
    }
    setError("Couldn't open the payment page. Please try again or contact support.");
    setPending(false);
  };

  const content = (
    <div className="w-full max-w-sm rounded-2xl border border-navy/10 bg-white p-7 text-center shadow-xl">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-soft text-red">
        <ShieldAlert className="h-6 w-6" strokeWidth={2} />
      </span>
      {activating ? (
        <>
          <p className="mt-4 font-display text-lg font-bold text-navy">Activating your account…</p>
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-navy/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirming your payment with Stripe.
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 font-display text-lg font-bold text-navy">Payment Needed</p>
          <p className="mt-2 text-sm text-navy/60">
            We couldn&apos;t process your last payment. Your access is paused, but your seat is still held — pay
            now or update your card to pick up right where you left off.
          </p>
          {error ? <p className="mt-3 text-sm font-medium text-red">{error}</p> : null}
          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={handlePay}
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-dark disabled:opacity-60"
            >
              <CreditCard className="h-4 w-4" strokeWidth={2} />
              {pending ? "Opening…" : "Pay or Update Card"}
            </button>
            <StudentLogoutButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim" />
          </div>
        </>
      )}
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 px-6 py-16 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-dim px-6 py-16">{content}</div>
  );
}
