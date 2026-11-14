"use client";

import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, X } from "lucide-react";
import { joinOneOnOneNotify } from "@/lib/oneOnOne/notify";
import { validateEnrollmentFields } from "@/lib/enrollment/validate";

export type NotifySelection = {
  /** Real `phases.id`, re-validated on the server. */
  phaseId: string;
  phaseTitle: string;
};

const EMPTY_FIELDS = { fullName: "", email: "", phone: "" };
type Fields = typeof EMPTY_FIELDS;
type Errors = Partial<Record<"fullName" | "email" | "phone", string>>;

const SUBMIT_ERROR_MESSAGES: Record<string, string> = {
  phase_unavailable: "This phase isn't available right now. Please close this form and try again later.",
  save_failed: "Something went wrong saving your details. Please try again.",
};

const INPUT =
  "mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10";

/** Remounts per phase so the form resets when a different phase's button is used. */
export default function OneOnOneNotifyModal({
  selection,
  onClose,
}: {
  selection: NotifySelection | null;
  onClose: () => void;
}) {
  if (!selection) return null;
  return <NotifyDialog key={selection.phaseId} selection={selection} onClose={onClose} />;
}

function NotifyDialog({ selection, onClose }: { selection: NotifySelection; onClose: () => void }) {
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; firstName: string } | null>(null);
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

  const field = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // No country field on this form, so pass a placeholder and only name/email/phone are checked.
    const validationErrors: Errors = validateEnrollmentFields({ ...fields, country: "-" });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setStatus("submitting");
    setErrorMessage(null);
    try {
      const result = await joinOneOnOneNotify({ phaseId: selection.phaseId, ...fields });
      if (result.ok) {
        setSuccess({ email: result.email, firstName: result.firstName });
        setStatus("success");
      } else {
        if (result.error === "validation") setErrors(result.fieldErrors);
        setErrorMessage(SUBMIT_ERROR_MESSAGES[result.error] ?? "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch (err) {
      console.error("[One-on-one] Unexpected error submitting notify form:", err);
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
        aria-labelledby="one-on-one-notify-title"
        onClick={(e) => e.stopPropagation()}
        className={`relative max-h-[90vh] w-full max-w-lg overflow-hidden overflow-y-auto rounded-3xl border border-navy/10 bg-white shadow-2xl shadow-navy/30 transition-all duration-300 ${
          shown ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0"
        }`}
      >
        <div className="h-1.5 bg-gradient-to-r from-navy via-blue to-navy" />

        <div className="p-6 sm:p-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-7 flex h-9 w-9 items-center justify-center rounded-full text-navy/50 transition-colors hover:bg-navy/5 hover:text-navy"
          >
            <X className="h-5 w-5" />
          </button>

          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-soft text-navy">
            <BellRing className="h-5 w-5" strokeWidth={2} />
          </span>
          <h2 id="one-on-one-notify-title" className="mt-4 font-display text-2xl font-bold text-navy">
            No one-on-one slots open yet
          </h2>
          <p className="mt-2 text-sm text-navy/60">
            Leave your details and we&apos;ll email you when the next one-on-one batch opens.
          </p>

          <div className="mt-6 rounded-2xl border-l-4 border-navy bg-cream-dim/70 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/50">You&apos;re asking about</p>
            <p className="mt-1 font-display text-base font-bold text-navy">
              {selection.phaseTitle} — Personalised One-on-One
            </p>
          </div>

          {status === "success" && success ? (
            <div className="mt-6 rounded-2xl border border-navy/10 bg-cream-dim/60 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-soft text-navy">
                <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
              </span>
              <p className="mt-4 font-display text-lg font-bold text-navy">
                You&apos;re on the list, {success.firstName}.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-navy/60">
                We&apos;ll email <span className="font-semibold text-navy">{success.email}</span> as soon as new
                one-on-one slots open. Slots go to whoever reserves first.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-navy px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-navy-dark"
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
                  autoComplete="name"
                  value={fields.fullName}
                  onChange={field("fullName")}
                  className={`${INPUT} ${errors.fullName ? "border-red/50" : "border-navy/15"}`}
                />
                {errors.fullName ? <p className="mt-1 text-xs font-medium text-red">{errors.fullName}</p> : null}
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-navy">
                    Email Address <span className="text-red">*</span>
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={fields.email}
                    onChange={field("email")}
                    className={`${INPUT} ${errors.email ? "border-red/50" : "border-navy/15"}`}
                  />
                  {errors.email ? <p className="mt-1 text-xs font-medium text-red">{errors.email}</p> : null}
                </div>
                <div>
                  <label className="text-sm font-semibold text-navy">
                    Phone Number <span className="text-red">*</span>
                  </label>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={fields.phone}
                    onChange={field("phone")}
                    className={`${INPUT} ${errors.phone ? "border-red/50" : "border-navy/15"}`}
                  />
                  {errors.phone ? <p className="mt-1 text-xs font-medium text-red">{errors.phone}</p> : null}
                </div>
              </div>

              {status === "error" && errorMessage ? (
                <p className="rounded-xl bg-red-soft/60 px-4 py-3 text-sm font-medium text-red-dark">{errorMessage}</p>
              ) : null}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-navy-dark disabled:translate-y-0 disabled:opacity-60"
              >
                <BellRing className="h-4 w-4" strokeWidth={2.5} />
                {status === "submitting" ? "Saving…" : "Notify me when it opens"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
