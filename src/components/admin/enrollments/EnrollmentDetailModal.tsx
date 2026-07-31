"use client";

import { useState } from "react";
import { Mail, Phone, User, X } from "lucide-react";
import type { EnrollmentRow, EnrollmentStatus } from "@/types/database";
import {
  confirmEnrollmentPayment,
  updateEnrollmentStatus,
} from "@/app/admin/(dashboard)/enrollments/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "./StatusBadge";
import PaymentBadge from "./PaymentBadge";

const STATUS_OPTIONS: EnrollmentStatus[] = ["NEW", "CONTACTED", "ENROLLED", "NOT_INTERESTED"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">{label}</p>
      <p className="mt-0.5 text-sm text-navy">{value}</p>
    </div>
  );
}

export default function EnrollmentDetailModal({
  enrollment,
  onClose,
  onStatusChanged,
  onPaymentConfirmed,
}: {
  enrollment: EnrollmentRow;
  onClose: () => void;
  onStatusChanged: (id: string, status: EnrollmentStatus) => void;
  onPaymentConfirmed: (id: string, paidAt: string) => void;
}) {
  const { showToast } = useToast();
  const [pendingStatus, setPendingStatus] = useState<EnrollmentStatus | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);

  const handleStatusClick = async (status: EnrollmentStatus) => {
    if (status === enrollment.status || pendingStatus) return;
    setPendingStatus(status);
    const result = await updateEnrollmentStatus(enrollment.id, status);
    setPendingStatus(null);
    if (result.ok) {
      onStatusChanged(enrollment.id, status);
      showToast("Status updated.");
    } else {
      showToast(result.error || "Failed to update status.", "error");
    }
  };

  const handleConfirmPayment = async () => {
    setConfirmingPayment(true);
    const result = await confirmEnrollmentPayment(enrollment.id);
    setConfirmingPayment(false);
    setShowConfirmPayment(false);
    if (result.ok) {
      onPaymentConfirmed(enrollment.id, result.paidAt);
      showToast(
        result.alreadyConfirmed
          ? "Payment was already confirmed."
          : "Payment confirmed — student added to Students."
      );
    } else {
      showToast(result.error || "Failed to confirm payment.", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-navy/10 bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-navy/10 bg-white px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
              Enrollment Application
            </p>
            <p className="mt-0.5 font-display text-lg font-bold text-navy">{enrollment.full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-navy/50 transition-colors hover:bg-navy/5 hover:text-navy"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Student Details</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Name"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                    {enrollment.full_name}
                  </span>
                }
              />
              <Field
                label="Email"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                    {enrollment.email}
                  </span>
                }
              />
              <Field
                label="Phone"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                    {enrollment.phone}
                  </span>
                }
              />
              <Field label="Country" value={enrollment.country} />
            </div>
          </div>

          <div className="rounded-2xl border-l-4 border-red bg-red-soft/40 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-dark">
              Course Selection
            </p>
            <p className="mt-1 font-display text-base font-bold text-navy">{enrollment.phase_name}</p>
            {enrollment.level_name ? (
              <p className="mt-0.5 text-sm text-navy/70">{enrollment.level_name}</p>
            ) : null}
            <p className="mt-0.5 text-sm text-navy/60">{enrollment.batch_timing}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Enrollment ID" value={enrollment.enrollment_ref} />
            <Field
              label="Amount Due"
              value={`C$${Number(enrollment.amount_due).toFixed(2)} ${enrollment.currency}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Current French Level" value={enrollment.current_french_level || "—"} />
            <Field label="Preferred Contact" value={enrollment.preferred_contact_method} />
          </div>

          <Field label="Message" value={enrollment.message || "—"} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Submitted" value={formatDate(enrollment.created_at)} />
            <Field
              label="Confirmation Email"
              value={
                enrollment.confirmation_email_status === "sent"
                  ? "Sent"
                  : enrollment.confirmation_email_status === "failed"
                    ? "Failed to send"
                    : "Pending"
              }
            />
          </div>

          <div className="rounded-2xl border border-navy/10 bg-cream-dim/50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Payment</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <PaymentBadge status={enrollment.payment_status} />
              {enrollment.payment_status === "PENDING" ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmPayment(true)}
                  className="rounded-full bg-red px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark"
                >
                  Confirm Payment Received
                </button>
              ) : null}
            </div>
            {enrollment.payment_status === "PAID" ? (
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                ✓ Payment Confirmed
                {enrollment.paid_at ? (
                  <span className="ml-1 font-normal text-navy/50">
                    — Confirmed on: {formatDate(enrollment.paid_at)}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-2 text-xs text-navy/50">
                Only confirm after checking that the Interac e-Transfer has actually arrived.
              </p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Status</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={enrollment.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={option === enrollment.status || pendingStatus !== null}
                  onClick={() => handleStatusClick(option)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    option === enrollment.status
                      ? "border-red bg-red text-white"
                      : "border-navy/15 bg-white text-navy/70 hover:border-red/30 hover:text-red"
                  }`}
                >
                  {pendingStatus === option ? "Saving…" : option.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirmPayment}
        title="Confirm Payment"
        description={`Are you sure you have received the Interac e-Transfer for ${enrollment.full_name} (${enrollment.enrollment_ref}) — C$${Number(enrollment.amount_due).toFixed(2)} ${enrollment.currency}? Only confirm this after checking that the payment has actually arrived.`}
        confirmLabel="Yes, Payment Received"
        pending={confirmingPayment}
        onCancel={() => setShowConfirmPayment(false)}
        onConfirm={handleConfirmPayment}
      />
    </div>
  );
}
