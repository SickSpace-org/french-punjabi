import { CheckCircle2, Mail, Repeat, CreditCard } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import { getStripeClient } from "@/lib/stripe/client";

/**
 * Public Enroll cutover's success landing page — Stripe redirects here
 * after a real checkout completes. Deliberately doesn't assume the
 * student is already activated: that happens asynchronously once Stripe
 * delivers checkout.session.completed to our webhook, which is normally
 * seconds but not guaranteed instant — this page is about confirming the
 * PAYMENT went through and explaining what happens next, not reading the
 * student's own row.
 */
export default async function EnrollSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  let mode: "subscription" | "payment" | null = null;
  let amount: number | null = null;
  let currency: string | null = null;
  let email: string | null = null;

  if (session_id) {
    try {
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(session_id);
      mode = session.mode === "subscription" ? "subscription" : "payment";
      amount = session.amount_total != null ? session.amount_total / 100 : null;
      currency = session.currency?.toUpperCase() ?? null;
      email = session.customer_details?.email ?? session.customer_email ?? null;
    } catch {
      // Expired/invalid session id — fall through to the generic message below.
    }
  }

  const isTrial = mode === "subscription";

  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden bg-cream-dim/40">
        <div className="mx-auto max-w-xl px-4 py-16 sm:py-24">
          <div className="rounded-3xl border border-navy/10 bg-white p-8 text-center shadow-sm sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-soft text-red">
              <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
            </span>
            <h1 className="mt-5 font-display text-2xl font-bold text-navy">
              {isTrial ? "Your Free Trial Has Started" : "You're Enrolled!"}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-navy/60">
              {isTrial
                ? "No charge today. Your card is on file and your seat is confirmed for the next 7 days — your first charge happens automatically after that, then monthly until you cancel."
                : amount != null
                  ? `Your payment of ${currency} $${amount.toFixed(2)} went through and your seat is confirmed.`
                  : "Your payment went through and your seat is confirmed."}
            </p>

            <div className="mt-7 space-y-4 rounded-2xl border border-navy/10 bg-cream-dim/60 p-5 text-left">
              <p className="text-[11px] font-bold uppercase tracking-wide text-navy/50">What happens next</p>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-red" strokeWidth={2} />
                <p className="text-sm text-navy/70">
                  Check {email ? <span className="font-semibold text-navy">{email}</span> : "your email"} for a welcome
                  email with your student portal sign-in link, batch, level, and class timings.
                </p>
              </div>
              {isTrial ? (
                <div className="flex items-start gap-3">
                  <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-red" strokeWidth={2} />
                  <p className="text-sm text-navy/70">
                    You can cancel any time during your trial from your Subscription page with no charge.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-red" strokeWidth={2} />
                  <p className="text-sm text-navy/70">This is a one-time payment — nothing else will be charged for this program.</p>
                </div>
              )}
            </div>

            <p className="mt-6 text-xs text-navy/40">
              If your welcome email doesn&apos;t arrive within a few minutes, check spam or contact us.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
