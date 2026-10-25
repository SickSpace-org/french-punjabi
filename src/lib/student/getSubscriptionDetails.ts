import "server-only";
import { getStripeClient } from "@/lib/stripe/client";
import type { StudentRow } from "@/types/database";

export type SubscriptionDetails = {
  cardBrand: string | null;
  cardLast4: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

/**
 * Always reads live from Stripe rather than caching cancel_at_period_end
 * locally — students has no column for it, and this page is the only
 * thing that needs it, so a live read is simpler and can't go stale.
 */
export async function getSubscriptionDetails(student: StudentRow): Promise<SubscriptionDetails | null> {
  if (!student.stripe_subscription_id) return null;

  try {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(student.stripe_subscription_id);
    const item = subscription.items.data[0];

    let cardBrand: string | null = null;
    let cardLast4: string | null = null;
    const pm = subscription.default_payment_method;
    if (pm) {
      const paymentMethod = typeof pm === "string" ? await stripe.paymentMethods.retrieve(pm) : pm;
      cardBrand = paymentMethod.card?.brand ?? null;
      cardLast4 = paymentMethod.card?.last4 ?? null;
    }

    return {
      cardBrand,
      cardLast4,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    };
  } catch (err) {
    console.error("[Student] Failed to fetch live subscription details:", err);
    return null;
  }
}
