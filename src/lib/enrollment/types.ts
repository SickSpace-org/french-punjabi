import type { PaymentMode, ProgramOfferKey } from "@/types/database";
import type { SubscriptionCheckoutResult } from "@/lib/payments/types";

export type EnrollmentPayload = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  frenchLevel: string;
  contactMethod: string;
  message: string;
  /** Real `batches.id` UUID — set when the student picked a specific phase/level batch. */
  batchId?: string;
  /** Set instead of `batchId` for whole-program offers (Complete Program / Redo a Month). */
  programOfferKey?: ProgramOfferKey;
  /** Only meaningful with `batchId` — which pricing row (full phase vs monthly) to charge. */
  paymentMode?: PaymentMode;
  /** Only read when the Stripe cutover flag is on (see submitEnrollmentOrCheckout) — the manual flow has no terms/referral step today and ignores these. */
  termsAccepted?: boolean;
  referralCode?: string;
};

/**
 * The public Enroll-page Stripe cutover's result shape (behind
 * NEXT_PUBLIC_STRIPE_ENROLL_ENABLED — see submitEnrollmentOrCheckout in
 * actions.ts). A plain union with EnrollmentResult rather than a new type
 * entirely: when the flag is off, or the student picked a program offer
 * (not yet supported by the Stripe path — see the note on
 * submitEnrollmentOrCheckout), the exact same EnrollmentResult shape comes
 * back as today; only the new `redirectUrl` branch is actually new.
 */
export type EnrollmentOrCheckoutResult = EnrollmentResult | SubscriptionCheckoutResult;

export type EnrollmentResult =
  | {
      ok: true;
      emailSent: boolean;
      email: string;
      firstName: string;
      enrollmentRef: string;
      amountDue: number;
      currency: string;
    }
  | {
      ok: false;
      error:
        | "validation"
        | "batch_unavailable"
        | "offer_unavailable"
        | "missing_selection"
        | "pricing_unavailable"
        | "save_failed";
      fieldErrors?: Partial<Record<"fullName" | "email" | "phone" | "country", string>>;
    };
