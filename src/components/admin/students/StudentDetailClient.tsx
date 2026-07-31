"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Key, Mail, Phone, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import type { StudentDetail } from "@/lib/students/getStudentDetail";
import {
  deleteStudentAccount,
  reactivateStudent,
  sendLoginLink,
  sendPortalInvite,
  setTemporaryPassword,
  suspendStudent,
} from "@/app/admin/(dashboard)/students/[studentId]/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">{label}</p>
      <p className="mt-0.5 text-sm text-navy">{value}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUSPENDED: "border-red/20 bg-red-soft text-red-dark",
  INACTIVE: "border-navy/15 bg-navy/5 text-navy/50",
};

export default function StudentDetailClient({ initialStudent }: { initialStudent: StudentDetail }) {
  const { showToast } = useToast();
  const [student, setStudent] = useState(initialStudent);
  const [pending, startTransition] = useTransition();
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [authActionPending, setAuthActionPending] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [passwordEmailSent, setPasswordEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSuspendToggle = () => {
    if (student.status === "ACTIVE") {
      setConfirmSuspend(true);
      return;
    }
    startTransition(async () => {
      const result = await reactivateStudent(student.id);
      if (result.ok) {
        setStudent((prev) => ({ ...prev, status: "ACTIVE" }));
        showToast("Student reactivated — access restored.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  const confirmSuspendNow = () => {
    startTransition(async () => {
      const result = await suspendStudent(student.id);
      setConfirmSuspend(false);
      if (result.ok) {
        setStudent((prev) => ({ ...prev, status: "SUSPENDED" }));
        showToast("Student suspended — all course access is now blocked.");
      } else {
        showToast("Unable to save changes. Please try again.", "error");
      }
    });
  };

  const handleSendInvite = async () => {
    setAuthActionPending(true);
    const result = await sendPortalInvite(student.id);
    setAuthActionPending(false);
    if (result.ok) {
      setStudent((prev) => ({ ...prev, auth_user_id: "pending" }));
      showToast(
        result.mode === "invited"
          ? "Invite email sent."
          : "This email already had a portal account — linked it instead (no email was sent)."
      );
    } else {
      showToast(result.error, "error");
    }
  };

  const handleSendLoginLink = async () => {
    setAuthActionPending(true);
    const result = await sendLoginLink(student.id);
    setAuthActionPending(false);
    showToast(result.ok ? "Login link sent." : result.error, result.ok ? "success" : "error");
  };

  const handleSetPassword = async () => {
    setAuthActionPending(true);
    const result = await setTemporaryPassword(student.id);
    setAuthActionPending(false);
    if (result.ok) {
      setRevealedPassword(result.password);
      setPasswordEmailSent(result.emailSent);
      setCopied(false);
      showToast(
        result.emailSent
          ? "Login link + password emailed to the student."
          : "Password set. Email wasn't sent (Resend isn't configured yet) — share it manually below."
      );
    } else {
      showToast(result.error, "error");
    }
  };

  const handleCopyPassword = async () => {
    if (!revealedPassword) return;
    try {
      await navigator.clipboard.writeText(revealedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable — the password is still visible on screen.
    }
  };

  const handleDeleteAccount = () => {
    startTransition(async () => {
      const result = await deleteStudentAccount(student.id);
      // On success this action redirect()s server-side — we only ever get
      // here on failure (redirect throws internally and never returns).
      if (!result?.ok) {
        setConfirmDelete(false);
        showToast(result?.error ?? "Unable to delete this account. Please try again.", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-navy/10 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                  {student.email}
                </span>
              }
            />
            <Field
              label="Phone"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                  {student.phone}
                </span>
              }
            />
            <Field label="Country" value={student.country} />
            <Field label="Enrollment Reference" value={student.enrollment_ref} />
            <Field label="Enrolled" value={formatDate(student.enrolled_at)} />
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                STATUS_STYLES[student.status] ?? STATUS_STYLES.INACTIVE
              }`}
            >
              {student.status}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={handleSuspendToggle}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-60 ${
                student.status === "ACTIVE"
                  ? "border-red/20 bg-white text-red hover:bg-red-soft"
                  : "border-navy/15 bg-white text-navy hover:bg-cream-dim"
              }`}
            >
              {student.status === "ACTIVE" ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                  Suspend Student
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Reactivate Student
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-navy/10 bg-cream-dim/50 px-4 py-2.5 text-xs text-navy/60">
          While ACTIVE, this student can see every published course in the Student Portal — access
          isn&apos;t assigned course-by-course.
        </p>
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Portal Access</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-navy">
            {student.auth_user_id ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
                Login Active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-navy/15 bg-navy/5 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-navy/50">
                Not Yet Invited
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            {!student.auth_user_id ? (
              <button
                type="button"
                disabled={authActionPending}
                onClick={handleSendInvite}
                className="rounded-full bg-red px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
              >
                {authActionPending ? "Sending…" : "Send Portal Invite"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={authActionPending}
                  onClick={handleSendLoginLink}
                  className="rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
                >
                  {authActionPending ? "Sending…" : "Send Login Link"}
                </button>
                <button
                  type="button"
                  disabled={authActionPending}
                  onClick={handleSetPassword}
                  className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
                >
                  <Key className="h-3.5 w-3.5" strokeWidth={2} />
                  {authActionPending ? "Setting…" : "Set Temporary Password (fallback)"}
                </button>
              </>
            )}
          </div>
        </div>

        {!student.auth_user_id ? (
          <p className="mt-2 text-xs text-navy/45">
            If this email already has an account elsewhere (e.g. it's also an admin), it'll be linked
            silently instead — no email is sent in that case.
          </p>
        ) : null}

        {revealedPassword ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-800">
              {passwordEmailSent
                ? "Also emailed to the student directly, with a one-click sign-in link. This copy won't be shown again."
                : "Email wasn't sent (Resend isn't configured yet) — share this with the student directly (e.g. WhatsApp/phone) instead. Won't be shown again."}{" "}
              They&apos;ll need to click &ldquo;Have a password instead?&rdquo; on the login page to use it.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-navy">
                {revealedPassword}
              </code>
              <button
                type="button"
                onClick={handleCopyPassword}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-red/20 bg-red-soft/30 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Danger Zone</p>
        <p className="mt-1 text-sm text-navy/60">
          Permanently deletes this account and its portal login, progress, comments and course
          access. Their enrollment application record is kept, just unlinked from this account.
        </p>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-red/30 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-red hover:bg-red-soft"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          Delete Student Account
        </button>
      </div>

      <ConfirmDialog
        open={confirmSuspend}
        title="Suspend this student?"
        description="They immediately lose access to ALL course content. Progress, comments, and enrollment are kept — reactivating restores access."
        confirmLabel="Suspend Student"
        danger
        pending={pending}
        onCancel={() => setConfirmSuspend(false)}
        onConfirm={confirmSuspendNow}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Permanently delete this account?"
        description={`This removes ${student.full_name}'s portal login, progress, comments, and course access entirely. This cannot be undone — there is no restore for a deleted account (unlike suspend).`}
        confirmLabel="Delete Permanently"
        danger
        pending={pending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
