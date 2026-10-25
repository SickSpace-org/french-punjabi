import "server-only";
import { getStripeClient } from "@/lib/stripe/client";

/**
 * Fixed, well-known Stripe Coupon IDs (not stored anywhere in our own
 * database — Stripe object IDs, created idempotently below) for the two
 * $25-off-once referral rewards. Both use Stripe's native
 * duration:'once', which is what makes "never a reusable balance,
 * applies to exactly one invoice" a platform-enforced guarantee rather
 * than application logic that could have a bug in it.
 */
export const REFERRED_DISCOUNT_COUPON_ID = "referral-referred-25-off-once";
export const REFERRER_DISCOUNT_COUPON_ID = "referral-referrer-25-off-once";

async function ensureCoupon(id: string, name: string) {
  const stripe = getStripeClient();
  try {
    await stripe.coupons.retrieve(id);
  } catch {
    await stripe.coupons.create({
      id,
      name,
      amount_off: 2500,
      currency: "cad",
      duration: "once",
    });
  }
}

/** Called lazily, once, the first time either coupon is needed — cheap
 * to call every time (one retrieve call, only creates on a 404). */
export async function ensureReferralCoupons() {
  await ensureCoupon(REFERRED_DISCOUNT_COUPON_ID, "Referral — $25 off your first payment");
  await ensureCoupon(REFERRER_DISCOUNT_COUPON_ID, "Referral reward — $25 off one month");
}
