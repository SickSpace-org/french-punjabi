"use client";

import { useState, useTransition } from "react";
import { Check, Copy, GraduationCap, Mail, Phone, RefreshCw, Save, Send, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import type { StudentDetail, StudentAttendanceSummary } from "@/lib/students/getStudentDetail";
import { ATTENDANCE_WINDOW_DAYS, dayLabel } from "@/lib/attendance/schedule";
import { setAttendanceStatus } from "@/app/admin/(dashboard)/courses/actions";
import {
  deleteStudentAccount,
  reactivateStudent,
  regeneratePortalAccessLink,
  sendLoginLink,
  sendPasswordToStudent,
  sendPortalInvite,
  setStudentPassword,
  suspendStudent,
  updateStudentEnrolledDate,
} from "@/app/admin/(dashboard)/students/[studentId]/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

function toDateInputValue(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

/** Same click-to-toggle P/A grid as the admin Attendance page's BatchCard, scoped to one student. */
function AttendanceGrid({ studentId, attendance }: { studentId: string; attendance: StudentAttendanceSummary }) {
  const { showToast } = useToast();
  const [presentDates, setPresentDates] = useState<Set<string>>(() => new Set(attendance.presentDates));
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const toggle = async (date: string) => {
    const currentlyPresent = presentDates.has(date);
    const nextPresent = !currentlyPresent;

    setPendingDate(date);
    setPresentDates((prev) => {
      const next = new Set(prev);
      if (nextPresent) next.add(date);
      else next.delete(date);
      return next;
    });

    const result = await setAttendanceStatus(studentId, attendance.batchId, date, nextPresent);
    setPendingDate(null);

    if (!result.ok) {
      setPresentDates((prev) => {
        const next = new Set(prev);
        if (currentlyPresent) next.add(date);
        else next.delete(date);
        return next;
      });
      showToast(result.error, "error");
    }
  };

  const presentCount = attendance.classDates.filter((d) => presentDates.has(d)).length;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="font-display text-xl font-bold text-navy">
          {presentCount}
          <span className="text-navy/40"> / {attendance.totalCount}</span>
        </p>
        <p className="text-xs text-navy/50">classes attended in the last {ATTENDANCE_WINDOW_DAYS} days</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {attendance.classDates.map((date) => {
          const present = presentDates.has(date);
          const isPending = pendingDate === date;
          return (
            <button
              key={date}
              type="button"
              disabled={isPending}
              onClick={() => toggle(date)}
              title="Click to toggle Present/Absent"
              className={`inline-flex flex-col items-center rounded-lg border px-2 py-1 text-[10px] font-bold leading-tight transition-opacity hover:opacity-75 disabled:cursor-wait disabled:opacity-50 ${
                present
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red/20 bg-red-soft text-red-dark"
              }`}
            >
              <span>
                {dayLabel(date)} {formatShortDate(date)}
              </span>
              <span>{present ? "P" : "A"}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

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
  const [regeneratingLink, setRegeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [enrolledDateInput, setEnrolledDateInput] = useState(toDateInputValue(student.enrolled_at));
  const [savingEnrolledDate, setSavingEnrolledDate] = useState(false);

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
          ? "Account created — sign-in code + password emailed to the student."
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
      result.ok ? "Sign-in code + password emailed to the student." : result.error,
      result.ok ? "success" : "error"
    );
  };

  const handleCopyLink = async () => {
    if (!student.portalAccessLink) return;
    await navigator.clipboard.writeText(student.portalAccessLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  const handleRegenerateLink = async () => {
    setRegeneratingLink(true);
    const result = await regeneratePortalAccessLink(student.id);
    setRegeneratingLink(false);
    showToast(
      result.ok ? "New access link emailed — the old link no longer works." : result.error,
      result.ok ? "success" : "error"
    );
    if (result.ok) {
      setStudent((prev) => ({ ...prev, portalAccessLink: result.accessLink }));
    }
  };

  const handleSaveEnrolledDate = async () => {
    setSavingEnrolledDate(true);
    const result = await updateStudentEnrolledDate(student.id, enrolledDateInput);
    setSavingEnrolledDate(false);
    if (result.ok) {
      setStudent((prev) => ({ ...prev, enrolled_at: new Date(enrolledDateInput).toISOString() }));
      showToast("Enrolled date updated.");
    } else {
      showToast(result.error, "error");
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
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Enrolled</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={enrolledDateInput}
                  onChange={(e) => setEnrolledDateInput(e.target.value)}
                  className="rounded-lg border border-navy/15 bg-white px-2 py-1 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
                />
                <button
                  type="button"
                  disabled={
                    savingEnrolledDate || enrolledDateInput === toDateInputValue(student.enrolled_at)
                  }
                  onClick={handleSaveEnrolledDate}
                  className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-white px-3 py-1 text-[11px] font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-3 w-3" strokeWidth={2} />
                  {savingEnrolledDate ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
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
        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-dark">
          <GraduationCap className="h-3.5 w-3.5" strokeWidth={2} />
          Course &amp; Attendance
        </p>

        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Current Course</p>
          <p className="mt-0.5 text-sm font-semibold text-navy">
            {student.currentCourseLabel || "No confirmed course yet"}
          </p>
        </div>

        {student.batchHistory.length > 0 ? (
          <div className="mt-4 border-t border-navy/10 pt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Batch History</p>
            <ul className="mt-1.5 space-y-1.5">
              {student.batchHistory.map((entry, i) => (
                <li key={i} className="text-xs text-navy/60">
                  <span className="text-navy/40">{entry.fromLabel}</span>
                  <span className="mx-1.5">→</span>
                  <span className="font-semibold text-navy">{entry.toLabel}</span>
                  <span className="ml-2 text-navy/40">
                    {new Date(entry.changedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 border-t border-navy/10 pt-4">
          {!student.attendance ? (
            <p className="text-sm text-navy/50">No batch assigned yet — attendance can&apos;t be tracked.</p>
          ) : student.attendance.hasSchedule ? (
            student.attendance.classDates.length > 0 ? (
              <>
                <AttendanceGrid studentId={student.id} attendance={student.attendance} />
                <p className="mt-2 text-[11px] text-navy/40">Click any date to toggle Present/Absent.</p>
              </>
            ) : (
              <p className="text-sm text-navy/50">No classes scheduled in this window yet.</p>
            )
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="font-display text-xl font-bold text-navy">{student.attendance.presentCount}</p>
                <p className="text-xs text-navy/50">
                  classes attended (ever) — batch has no weekly schedule set yet
                </p>
              </div>
              {student.attendance.presentDates.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {student.attendance.presentDates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"
                    >
                      {formatShortDate(date)}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
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
            If this email already has an account elsewhere (e.g. it&apos;s also an admin), it&apos;ll be
            linked silently instead — no email is sent in that case.
          </p>
        ) : (
          <div className="mt-4 border-t border-navy/10 pt-4">
            <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
              Automatic Access Link
            </label>
            <p className="mt-0.5 text-xs text-navy/45">
              What actually gets emailed when payment is confirmed — one permanent, bookmarkable
              link, no password or code ever needed. Anyone holding it can open this student&apos;s
              portal, so regenerate it if it&apos;s ever shared or leaked.
            </p>
            {student.portalAccessLink ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-lg bg-cream-dim px-2.5 py-1.5 font-mono text-xs text-navy">
                  {student.portalAccessLink}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-label="Copy access link"
                  className="rounded-full p-1.5 text-navy/40 hover:bg-cream-dim hover:text-navy"
                >
                  {linkCopied ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-navy/45">No access link on file yet.</p>
            )}
            <button
              type="button"
              disabled={regeneratingLink}
              onClick={handleRegenerateLink}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
              {regeneratingLink ? "Regenerating…" : "Regenerate & Resend"}
            </button>
          </div>
        )}

        {!student.auth_user_id ? null : (
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
