const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EnrollmentFieldErrors = Partial<
  Record<"fullName" | "email" | "phone" | "country", string>
>;

export type EnrollmentFormFields = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
};

/** Shared between the client form (instant feedback) and the server action
 * (the actual trust boundary — the client check alone proves nothing). */
export function validateEnrollmentFields(fields: EnrollmentFormFields): EnrollmentFieldErrors {
  const errors: EnrollmentFieldErrors = {};
  if (!fields.fullName.trim()) errors.fullName = "Please enter your full name.";
  if (!fields.email.trim()) {
    errors.email = "Please enter your email address.";
  } else if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!fields.phone.trim()) errors.phone = "Please enter your phone number.";
  if (!fields.country.trim()) errors.country = "Please enter your country.";
  return errors;
}
