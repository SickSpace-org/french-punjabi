"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Save, Send, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import type { StudentDetail } from "@/lib/students/getStudentDetail";
import {
  deleteStudentAccount,
  reactivateStudent,
  sendLoginLink,
  sendPasswordToStudent,
  sendPortalInvite,
  setStudentPassword,
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
  const [passwordInput, setPasswordInput] = useState(student.portalPassword ?? "");
  const [passwordSaved, setPasswordSaved] = useState(student.portalPassword != null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingPassword, setSendingPassword] = useState(false);

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
        result.mode === "created"
          ? "Account created — login link + password emailed to the student."
          : "This email already had a portal account — linked it instead (no new email was sent)."
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

  const handleSavePassword = async () => {
    setSavingPassword(true);
    const result = await setStudentPassword(student.id, passwordInput);
    setSavingPassword(false);
    if (result.ok) {
      setPasswordSaved(true);
      showToast("Password saved.");
    } else {
      showToast(result.error, "error");
    }
  };

  const handleSendPassword = async () => {
    setSendingPassword(true);
    const result = await sendPasswordToStudent(student.id);
    setSendingPassword(false);
    showToast(
      result.ok ? "Sign-in link + password emailed to the student." : result.error,
      result.ok ? "success" : "error"
    );
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
              <button
                type="button"
                disabled={authActionPending}
                onClick={handleSendLoginLink}
                className="rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
              >
                {authActionPending ? "Sending…" : "Send Login Link"}
              </button>
            )}
          </div>
        </div>

        {!student.auth_user_id ? (
          <p className="mt-2 text-xs text-navy/45">
            If this email already has an account elsewhere (e.g. it's also an admin), it'll be linked
            silently instead — no email is sent in that case.
          </p>
        ) : (
          <div className="mt-4 border-t border-navy/10 pt-4">
            <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
              Portal Password
            </label>
            <p className="mt-0.5 text-xs text-navy/45">
              A permanent password you set and can view/edit anytime — used as a fallback alongside
              login links (choose &ldquo;Have a password instead?&rdquo; on the login page).
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordSaved(false);
                }}
                placeholder="Set a password"
                className="min-w-0 flex-1 rounded-xl border border-navy/15 bg-white px-3.5 py-2 font-mono text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
              />
              <button
                type="button"
                disabled={savingPassword || passwordInput.length < 6}
                onClick={handleSavePassword}
                className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
                {savingPassword ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={sendingPassword || !passwordSaved}
                onClick={handleSendPassword}
                className="inline-flex items-center gap-1.5 rounded-full bg-red px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
                {sendingPassword ? "Sending…" : "Send to Student"}
              </button>
            </div>
            {!passwordSaved && passwordInput.length > 0 ? (
              <p className="mt-1.5 text-[11px] text-amber-700">Unsaved changes — click Save first.</p>
            ) : null}
          </div>
        )}
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
