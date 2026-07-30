export type EnrollmentPayload = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  frenchLevel: string;
  contactMethod: string;
  message: string;
  phase: string;
  batch: string;
  timing: string;
  teacher?: string;
  feeLabel?: string;
  totalLabel?: string;
  paymentMode?: string;
};

/**
 * Not connected to a backend yet. The form, validation, and data shape
 * above are ready — wire this up to Supabase, Formspree, Google Sheets,
 * or an email API (or an existing backend) and remove the thrown error.
 * No other part of the Courses page needs to change when you do.
 */
export async function submitEnrollment(payload: EnrollmentPayload): Promise<void> {
  console.info("[Enrollment] Form is valid and ready to submit — no backend connected yet:", payload);
  throw new Error("BACKEND_NOT_CONNECTED");
}
