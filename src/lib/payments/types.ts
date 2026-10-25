export type SubscriptionCheckoutPayload = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  /** Real `batches.id` UUID — the only entry point for Stage 1 (no whole-program offers yet). */
  batchId: string;
  termsAccepted: boolean;
  /** Optional — a referrer's code. Validated server-side; silently ignored (not an error) if it doesn't resolve to anyone, or belongs to the person signing up themselves. */
  referralCode?: string;
};

export type SubscriptionCheckoutResult =
  | { ok: true; redirectUrl: string }
  | {
      ok: false;
      error:
        | "validation"
        | "terms_not_accepted"
        | "trial_already_used"
        | "batch_unavailable"
        | "pricing_unavailable"
        | "save_failed"
        | "checkout_failed";
      fieldErrors?: Partial<Record<"fullName" | "email" | "phone" | "country", string>>;
    };
