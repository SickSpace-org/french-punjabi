"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import { CONTACT_INFO } from "@/data/contact";

type BookCallButtonProps = {
  className?: string;
  children: React.ReactNode;
  /** Runs when the button is clicked, e.g. to close the mobile menu. */
  onClick?: () => void;
};

/**
 * "Book a call" trigger: collects name, email and a preferred time, then opens
 * WhatsApp to our number with a pre-filled message the visitor just has to send.
 */
export default function BookCallButton({ className, children, onClick }: BookCallButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onClick?.();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open ? createPortal(<BookCallDialog onClose={() => setOpen(false)} />, document.body) : null}
    </>
  );
}

type Errors = Partial<Record<"name" | "email" | "time", string>>;

function formatPreferredTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function BookCallDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [time, setTime] = useState("");
  const [errors, setErrors] = useState<Errors>({});
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = "Please enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Please enter a valid email.";
    if (!time) next.time = "Please pick a time that suits you.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const message = [
      `Hi, it's me ${name.trim()}. I'd like to book a consultation call.`,
      `Email: ${email.trim()}`,
      `Preferred time for the call: ${formatPreferredTime(time)}`,
    ].join("\n");

    window.open(
      `${CONTACT_INFO.whatsappHref}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    onClose();
  };

  const inputClass = (hasError: boolean) =>
    `mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10 ${
      hasError ? "border-red/50" : "border-navy/15"
    }`;

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
        aria-labelledby="book-call-title"
        onClick={(e) => e.stopPropagation()}
        className={`relative max-h-[90vh] w-full max-w-md overflow-hidden overflow-y-auto rounded-3xl border border-navy/10 bg-white text-left shadow-2xl shadow-navy/30 transition-all duration-300 ${
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

          <h2 id="book-call-title" className="font-display text-2xl font-bold text-navy">
            Book a consultation call
          </h2>
          <p className="mt-2 text-sm text-navy/60">
            Tell us who you are and when suits you. We&apos;ll open WhatsApp with your message
            ready to send to {CONTACT_INFO.whatsappDisplay}.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="book-call-name" className="text-sm font-semibold text-navy">
                Your Name <span className="text-red">*</span>
              </label>
              <input
                id="book-call-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass(!!errors.name)}
              />
              {errors.name ? <p className="mt-1 text-xs text-red">{errors.name}</p> : null}
            </div>

            <div>
              <label htmlFor="book-call-email" className="text-sm font-semibold text-navy">
                Email Address <span className="text-red">*</span>
              </label>
              <input
                id="book-call-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass(!!errors.email)}
              />
              {errors.email ? <p className="mt-1 text-xs text-red">{errors.email}</p> : null}
            </div>

            <div>
              <label htmlFor="book-call-time" className="text-sm font-semibold text-navy">
                Preferred Time for the Call <span className="text-red">*</span>
              </label>
              <input
                id="book-call-time"
                type="datetime-local"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass(!!errors.time)}
              />
              {errors.time ? <p className="mt-1 text-xs text-red">{errors.time}</p> : null}
            </div>

            <button
              type="submit"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1ebe5a]"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              Continue on WhatsApp
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
