"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import { submitEnrollment } from "@/lib/enrollment/actions";
import { validateEnrollmentFields } from "@/lib/enrollment/validate";
import { INTERAC_EMAIL } from "@/lib/enrollment/constants";
import type { PaymentMode, ProgramOfferKey } from "@/types/database";

export type EnrollSelection = {
  phase: string;
  batch: string;
  timing: string;
  teacher?: string;
  /** e.g. "$549 + Tax" — shown as the program fee in the modal summary. */
  feeLabel?: string;
  /** e.g. "$620.37 Total" or "$224.87 / month" — shown alongside feeLabel. */
  totalLabel?: string;
  /** e.g. "Full Phase" or "Monthly" — which payment plan was chosen (display only). */
  paymentMode?: string;
  /** Machine-readable form of paymentMode — what the server actually prices against. */
  paymentModeValue?: PaymentMode;
  /** Real `batches.id` UUID — the server re-validates against this, never
   * the display strings above. Set when a specific batch/timing was picked. */
  batchId?: string;
  /** Set instead of batchId for whole-program offers (Complete Program / Redo a Month). */
  programOfferKey?: ProgramOfferKey;
};

type EnrollModalProps = {
  selection: EnrollSelection | null;
  onClose: () => void;
};

const FRENCH_LEVELS = [
  "Beginner / Starting from Zero",
  "A1",
  "A2",
  "B1",
  "B2 or Above",
  "Not Sure",
];

const CONTACT_METHODS = [
  { value: "WhatsApp", icon: MessageCircle },
  { value: "Phone Call", icon: Phone },
  { value: "Email", icon: Mail },
] as const;

const EMPTY_FIELDS = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  frenchLevel: FRENCH_LEVELS[FRENCH_LEVELS.length - 1],
  contactMethod: CONTACT_METHODS[0].value as string,
  message: "",
};

type Fields = typeof EMPTY_FIELDS;
type Errors = Partial<Record<"fullName" | "email" | "phone" | "country", string>>;

const SUBMIT_ERROR_MESSAGES: Record<string, string> = {
  batch_unavailable:
    "This batch is no longer available. Please close this form and choose another available batch.",
  offer_unavailable: "This program option is no longer available. Please choose another option.",
  missing_selection: "Something went wrong with your selection. Please try again.",
  pricing_unavailable: "We couldn't load the price for this option. Please try again or contact us.",
  save_failed: "Something went wrong saving your application. Please try again.",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable — silently ignore, the value is still
      // visible on screen for the student to copy manually.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:border-red/30 hover:text-red"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" strokeWidth={2.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/**
 * Thin wrapper: renders nothing when no batch is selected, and remounts
 * EnrollDialog (via `key`) whenever a *different* batch/timing is chosen,
 * so the form and animation state reset naturally without an extra effect.
 */
export default function EnrollModal({ selection, onClose }: EnrollModalProps) {
  if (!selection) return null;
  const dialogKey = `${selection.phase}|${selection.batch}|${selection.timing}`;
  return <EnrollDialog key={dialogKey} selection={selection} onClose={onClose} />;
}

function EnrollDialog({
  selection,
  onClose,
}: {
  selection: EnrollSelection;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    emailSent: boolean;
    email: string;
    firstName: string;
    enrollmentRef: string;
    amountDue: number;
    currency: string;
  } | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const field =
    (key: keyof Omit<Fields, "contactMethod">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateEnrollmentFields(fields);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setStatus("submitting");
    setErrorMessage(null);
    try {
      const result = await submitEnrollment({
        fullName: fields.fullName,
        email: fields.email,
        phone: fields.phone,
        country: fields.country,
        frenchLevel: fields.frenchLevel,
        contactMethod: fields.contactMethod,
        message: fields.message,
        batchId: selection.batchId,
        programOfferKey: selection.programOfferKey,
        paymentMode: selection.paymentModeValue,
      });

      if (result.ok) {
        setSuccessInfo({
          emailSent: result.emailSent,
          email: result.email,
          firstName: result.firstName,
          enrollmentRef: result.enrollmentRef,
          amountDue: result.amountDue,
          currency: result.currency,
        });
        setStatus("success");
      } else {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setErrorMessage(SUBMIT_ERROR_MESSAGES[result.error] ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch (err) {
      console.error("[Enrollment] Unexpected error submitting form:", err);
      setErrorMessage("Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm transition-opacity duration-300 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="enroll-modal-title"
        onClick={(e) => e.stopPropagation()}
        className={`relative max-h-[90vh] w-full max-w-lg overflow-hidden overflow-y-auto rounded-3xl border border-navy/10 bg-white shadow-2xl shadow-navy/30 transition-all duration-300 ${
          shown ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div className="h-1.5 bg-gradient-to-r from-red-dark via-red to-red-dark" />

        <div className="p-6 sm:p-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-7 flex h-9 w-9 items-center justify-center rounded-full text-navy/50 transition-colors hover:bg-navy/5 hover:text-navy"
          >
            <X className="h-5 w-5" />
          </button>

          <h2
            id="enroll-modal-title"
            className="font-display text-2xl font-bold text-navy"
          >
            Enroll in a Batch
          </h2>
          <p className="mt-2 text-sm text-navy/60">
            Fill in your details and our team will contact you regarding your
            selected batch.
          </p>

          <div className="mt-6 rounded-2xl border-l-4 border-red bg-red-soft/50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-dark">
              Your Selection
            </p>
            <p className="mt-1 font-display text-base font-bold text-navy">
              {selection.phase} — {selection.batch}
            </p>
            <p className="mt-0.5 text-sm text-navy/60">{selection.timing}</p>
            {selection.teacher ? (
              <p className="mt-0.5 text-sm text-navy/60">
                Teacher: <span className="font-medium text-navy/80">{selection.teacher}</span>
              </p>
            ) : null}
            {selection.feeLabel ? (
              <div className="mt-3 space-y-1.5 border-t border-red/15 pt-3">
                {selection.paymentMode ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-navy/50">
                      Payment Option
                    </span>
                    <span className="font-display text-sm font-bold text-red-dark">
                      {selection.paymentMode}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-navy/50">
                    Program Fee
                  </span>
                  <span className="font-display text-sm font-bold text-red-dark">
                    {selection.feeLabel}
                  </span>
                </div>
                {selection.totalLabel ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-navy/50">
                      {selection.paymentMode === "Monthly" ? "Per Month" : "Total"}
                    </span>
                    <span className="font-display text-sm font-bold text-red-dark">
                      {selection.totalLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

        {status === "success" && successInfo ? (
          <div className="mt-6">
            <div className="rounded-2xl border border-navy/10 bg-cream-dim/60 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-soft text-red">
                <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
              </span>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-red-dark">
                Enrollment Request Received
              </p>
              <p className="mt-2 font-display text-lg font-bold text-navy">
                Thank you, {successInfo.firstName}.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-navy/60">
                We have received your enrollment request. To complete your
                enrollment, please send your course fee using Interac
                e-Transfer.
              </p>
              {successInfo.emailSent ? (
                <p className="mt-2 text-sm leading-relaxed text-navy/60">
                  A confirmation email has been sent to{" "}
                  <span className="font-semibold text-navy">{successInfo.email}</span>.
                </p>
              ) : null}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-navy/10 bg-white">
              <div className="bg-navy px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-white">
                  Interac e-Transfer
                </p>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                      Send Payment To
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-navy">{INTERAC_EMAIL}</p>
                  </div>
                  <CopyButton value={INTERAC_EMAIL} label="Copy Email" />
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-navy/10 pt-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                      Amount
                    </p>
                    <p className="mt-0.5 font-display text-xl font-bold text-red-dark">
                      C${successInfo.amountDue.toFixed(2)} {successInfo.currency}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-navy/10 pt-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                      Enrollment Reference
                    </p>
                    <p className="mt-0.5 truncate font-display text-sm font-bold text-navy">
                      {successInfo.enrollmentRef}
                    </p>
                  </div>
                  <CopyButton value={successInfo.enrollmentRef} label="Copy Reference" />
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-navy/10 bg-cream-dim/40 p-5">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy">
                <Building2 className="h-4 w-4 text-navy/50" strokeWidth={2} />
                Open Your Banking App
              </p>
              <ol className="mt-3 space-y-2 text-sm leading-relaxed text-navy/70">
                <li>1. Sign in to your Canadian online/mobile banking.</li>
                <li>2. Choose Interac e-Transfer.</li>
                <li>
                  3. Send the displayed amount to:{" "}
                  <span className="font-semibold text-navy">{INTERAC_EMAIL}</span>.
                </li>
                <li>4. Include your Enrollment Reference in the message/note where possible.</li>
                <li>5. Our team will confirm your enrollment after the payment is received.</li>
              </ol>
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft/50 px-4 py-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red" strokeWidth={2} />
              <p className="text-sm font-medium text-red-dark">
                <span className="font-bold uppercase tracking-wide">Important:</span> Your seat is
                not confirmed until payment has been received and verified by the French Punjabi
                team.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-red px-8 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-lg"
            >
              Done
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label className="text-sm font-semibold text-navy">
                Full Name <span className="text-red">*</span>
              </label>
              <input
                type="text"
                value={fields.fullName}
                onChange={field("fullName")}
                className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10 ${
                  errors.fullName ? "border-red/50" : "border-navy/15"
                }`}
              />
              {errors.fullName ? (
                <p className="mt-1 text-xs font-medium text-red">{errors.fullName}</p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-semibold text-navy">
                Email Address <span className="text-red">*</span>
              </label>
              <input
                type="email"
                value={fields.email}
                onChange={field("email")}
                className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10 ${
                  errors.email ? "border-red/50" : "border-navy/15"
                }`}
              />
              {errors.email ? (
                <p className="mt-1 text-xs font-medium text-red">{errors.email}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-navy">
                  Phone Number <span className="text-red">*</span>
                </label>
                <input
                  type="tel"
                  value={fields.phone}
                  onChange={field("phone")}
                  className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10 ${
                    errors.phone ? "border-red/50" : "border-navy/15"
                  }`}
                />
                {errors.phone ? (
                  <p className="mt-1 text-xs font-medium text-red">{errors.phone}</p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-semibold text-navy">
                  Country <span className="text-red">*</span>
                </label>
                <input
                  type="text"
                  value={fields.country}
                  onChange={field("country")}
                  className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10 ${
                    errors.country ? "border-red/50" : "border-navy/15"
                  }`}
                />
                {errors.country ? (
                  <p className="mt-1 text-xs font-medium text-red">{errors.country}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-navy">
                Current French Level
              </label>
              <select
                value={fields.frenchLevel}
                onChange={field("frenchLevel")}
                className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10"
              >
                {FRENCH_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-navy">
                Preferred Contact Method
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONTACT_METHODS.map(({ value, icon: Icon }) => {
                  const isSelected = fields.contactMethod === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setFields((prev) => ({ ...prev, contactMethod: value }))
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all duration-300 ${
                        isSelected
                          ? "border-red bg-red text-white shadow-sm shadow-red/30"
                          : "border-navy/15 bg-white text-navy/70 hover:border-red/30 hover:text-red"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-navy">
                Message / Questions
              </label>
              <textarea
                rows={3}
                value={fields.message}
                onChange={field("message")}
                placeholder="Anything you'd like us to know?"
                className="mt-1.5 w-full resize-none rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none transition-all placeholder:text-navy/35 focus:border-red focus:ring-4 focus:ring-red/10"
              />
            </div>

            {status === "error" && errorMessage ? (
              <div className="flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft/50 px-4 py-3">
                <CircleAlert className="h-4 w-4 shrink-0 text-red" strokeWidth={2} />
                <p className="text-sm font-medium text-red-dark">{errorMessage}</p>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-navy/15 bg-white px-7 py-3 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:border-navy/25 hover:shadow-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="group/submit inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-red px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {status === "submitting" ? "Submitting…" : "Submit Enrollment"}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover/submit:translate-x-1"
                  strokeWidth={2.5}
                />
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
