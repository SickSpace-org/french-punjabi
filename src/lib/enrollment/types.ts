import type { PaymentMode, ProgramOfferKey } from "@/types/database";

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
};

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
