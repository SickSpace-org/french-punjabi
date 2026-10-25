"use client";

import { useState } from "react";
import { createSubscriptionCheckout } from "@/lib/payments/subscriptionCheckout";
import { validateEnrollmentFields } from "@/lib/enrollment/validate";

export type TestBatchOption = {
  id: string;
  label: string;
  disabled: boolean;
  seatsLeft: number | null;
};

const EMPTY_FIELDS = { fullName: "", email: "", phone: "", country: "" };

const ERROR_MESSAGES: Record<string, string> = {
  validation: "Please fix the highlighted fields.",
  terms_not_accepted: "You must accept the terms to continue.",
  trial_already_used: "This email has already used its one free trial.",
  batch_unavailable: "That batch has no seats left (or was just taken by someone else).",
  pricing_unavailable: "No monthly pricing is configured for that batch's phase yet.",
  save_failed: "Something went wrong saving your application. Please try again.",
  checkout_failed: "Stripe checkout could not be started. Please try again.",
};

export default function SubscriptionTestForm({
  batches,
  termsText,
  initialReferralCode,
}: {
  batches: TestBatchOption[];
  termsText: string;
  initialReferralCode?: string;
}) {
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [referralCode, setReferralCode] = useState(initialReferralCode ?? "");
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY_FIELDS, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const field =
    (key: keyof typeof EMPTY_FIELDS) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors = validateEnrollmentFields(fields);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    if (!batchId) {
      setErrorMessage("Pick a batch.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    const result = await createSubscriptionCheckout({
      ...fields,
      batchId,
      termsAccepted,
      referralCode: referralCode.trim() || undefined,
    });

    if (result.ok) {
      window.location.href = result.redirectUrl;
      return;
    }

    if (result.fieldErrors) setErrors(result.fieldErrors);
    setErrorMessage(ERROR_MESSAGES[result.error] ?? "Something went wrong.");
    setStatus("error");
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(["fullName", "email", "phone", "country"] as const).map((key) => (
        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
          {key === "fullName" ? "Full name" : key.charAt(0).toUpperCase() + key.slice(1)}
          <input
            type={key === "email" ? "email" : "text"}
            value={fields[key]}
            onChange={field(key)}
            style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6 }}
          />
          {errors[key] ? <span style={{ color: "#b4432f", fontSize: 12 }}>{errors[key]}</span> : null}
        </label>
      ))}

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
        Batch
        <select
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6 }}
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id} disabled={b.disabled}>
              {b.label}
              {b.seatsLeft != null ? ` (${b.seatsLeft} left)` : ""}
              {b.disabled ? " — full" : ""}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
        Referral code (optional)
        <input
          type="text"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value)}
          placeholder="e.g. 7K4PXM2A"
          style={{ padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6 }}
        />
      </label>

      <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12, maxHeight: 140, overflowY: "auto", fontSize: 12, color: "#555" }}>
        {termsText}
      </div>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "flex-start" }}>
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
        I accept the Terms & Services above.
      </label>

      {errorMessage ? <p style={{ color: "#b4432f", fontSize: 13 }}>{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        style={{ padding: "10px 16px", background: "#0e7a72", color: "white", borderRadius: 6, border: "none", fontWeight: 600 }}
      >
        {status === "submitting" ? "Starting checkout…" : "Start Stripe test checkout"}
      </button>
    </form>
  );
}
