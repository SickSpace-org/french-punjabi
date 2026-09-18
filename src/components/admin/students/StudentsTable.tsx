"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Check, Copy, GraduationCap, Send, Trash2 } from "lucide-react";
import type { AdminStudentRow } from "@/lib/courses/getAdminStudents";
import {
  deleteStudentAccount,
  sendFeeReminder,
  sendPasswordToStudent,
  setStudentStatus,
  updateStudentCourse,
  type StudentStatus,
} from "@/app/admin/(dashboard)/students/[studentId]/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

export type BatchOption = { id: string; label: string };

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUSPENDED: "border-red/20 bg-red-soft text-red-dark",
  INACTIVE: "border-navy/15 bg-navy/5 text-navy/50",
};

const STATUS_OPTIONS: StudentStatus[] = ["ACTIVE", "SUSPENDED", "INACTIVE"];

function StatusCell({
  student,
  onStatusChanged,
}: {
  student: AdminStudentRow;
  /** Called after a successful status change, e.g. so a list scoped to one status can drop the row. */
  onStatusChanged?: (id: string, next: StudentStatus) => void;
}) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<StudentStatus>(student.status as StudentStatus);
  const [saving, setSaving] = useState(false);

  const handleChange = async (next: StudentStatus) => {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    setSaving(true);
    const result = await setStudentStatus(student.id, next);
    setSaving(false);
    if (!result.ok) {
      setStatus(previous);
      showToast(result.error, "error");
    } else {
      showToast(`Status set to ${next}.`);
      onStatusChanged?.(student.id, next);
    }
  };

  return (
    <select
      value={status}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value as StudentStatus)}
      aria-label={`Status for ${student.full_name}`}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide outline-none disabled:opacity-60 ${
        STATUS_STYLES[status] ?? STATUS_STYLES.INACTIVE
      }`}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function CourseCell({ student, batchOptions }: { student: AdminStudentRow; batchOptions: BatchOption[] }) {
  const { showToast } = useToast();
  const [batchId, setBatchId] = useState(student.current_batch_id ?? "");
  const [label, setLabel] = useState(student.phase_label ?? "—");
  const [saving, setSaving] = useState(false);

  if (!student.current_enrollment_id) {
    return <span className="text-navy/70">{label}</span>;
  }

  const handleChange = async (nextBatchId: string) => {
    if (!nextBatchId || nextBatchId === batchId) return;
    const previousBatchId = batchId;
    const previousLabel = label;
    const nextLabel = batchOptions.find((b) => b.id === nextBatchId)?.label ?? label;
    setBatchId(nextBatchId);
    setLabel(nextLabel);
    setSaving(true);
    const result = await updateStudentCourse(student.current_enrollment_id!, student.id, nextBatchId);
    setSaving(false);
    if (!result.ok) {
      setBatchId(previousBatchId);
      setLabel(previousLabel);
      showToast(result.error, "error");
    } else {
      showToast("Course updated.");
    }
  };

  // The assigned batch may no longer exist live in Courses (deleted) — show
  // its frozen last-known name as a placeholder instead of a blank/misleading
  // selection, while still letting the admin reassign to a current batch.
  const currentBatchStillExists = !batchId || batchOptions.some((b) => b.id === batchId);

  return (
    <select
      value={batchId}
      disabled={saving || batchOptions.length === 0}
      onChange={(e) => handleChange(e.target.value)}
      aria-label={`Course for ${student.full_name}`}
      className="max-w-[220px] rounded-lg border border-navy/15 bg-white px-2 py-1 text-xs text-navy outline-none disabled:opacity-60"
    >
      {!currentBatchStillExists ? (
        <option value={batchId} disabled>
          {student.current_batch_label ?? label}
        </option>
      ) : !batchId ? (
        <option value="" disabled>
          {label}
        </option>
      ) : null}
      {batchOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function DeleteCell({
  student,
  onDeleted,
}: {
  student: AdminStudentRow;
  onDeleted: (id: string) => void;
}) {
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await deleteStudentAccount(student.id);
      // deleteStudentAccount redirect()s server-side on success — we only
      // ever get a return value here on failure (redirect throws internally
      // and never returns), same pattern as StudentDetailClient.
      if (!result?.ok) {
        setConfirmOpen(false);
        showToast(result?.error ?? "Unable to delete this student. Please try again.", "error");
      } else {
        onDeleted(student.id);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-label={`Delete ${student.full_name}`}
        title="Remove this student"
        className="rounded-full p-1.5 text-navy/40 hover:bg-red-soft hover:text-red-dark"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Remove this student?"
        description={`Permanently deletes ${student.full_name}'s portal login, progress, comments, and course access. Their enrollment application record is kept, just unlinked. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        danger
        pending={pending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
}

function FeesCell({ student }: { student: AdminStudentRow }) {
  const { showToast } = useToast();
  // Not persisted yet (needs a DB column that isn't live yet) — the admin
  // types a due date fresh each time right before sending; it's included
  // in that one reminder email only.
  const [dueDate, setDueDate] = useState("");
  const [sending, setSending] = useState(false);

  const handleRemind = async () => {
    setSending(true);
    const result = await sendFeeReminder(student.id, dueDate || null);
    setSending(false);
    showToast(
      result.ok ? "Fee reminder emailed to the student." : result.error,
      result.ok ? "success" : "error"
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        aria-label={`Payment due date to include in the reminder to ${student.full_name}`}
        title="Due date to mention in the reminder (optional)"
        className="rounded-lg border border-navy/15 bg-white px-2 py-1 text-xs text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
      />
      <button
        type="button"
        disabled={sending}
        onClick={handleRemind}
        aria-label="Send fee reminder email"
        title="Email a fee reminder to this student"
        className="rounded-full p-1.5 text-navy/40 hover:bg-cream-dim hover:text-red-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        <BellRing className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

function PasswordCell({ student }: { student: AdminStudentRow }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  if (!student.auth_user_id) {
    return <span className="text-xs text-navy/40">Not invited yet</span>;
  }
  if (!student.portalPassword) {
    return (
      <Link
        href={`/admin/students/${student.id}`}
        className="text-xs font-semibold text-navy/50 underline hover:text-red-dark"
      >
        Not set
      </Link>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(student.portalPassword!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSend = async () => {
    setSending(true);
    const result = await sendPasswordToStudent(student.id);
    setSending(false);
    showToast(
      result.ok ? "Sign-in code + password emailed to the student." : result.error,
      result.ok ? "success" : "error"
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded-lg bg-cream-dim px-2 py-1 font-mono text-xs text-navy">
        {student.portalPassword}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy password"
        className="rounded-full p-1 text-navy/40 hover:bg-cream-dim hover:text-navy"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
        )}
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        aria-label="Email password to student"
        title="Email sign-in code + password to this student"
        className="rounded-full p-1 text-navy/40 hover:bg-cream-dim hover:text-red-dark disabled:opacity-60"
      >
        <Send className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

export default function StudentsTable({
  students,
  batchOptions,
  onDeleted,
  onStatusChanged,
  emptyMessage,
}: {
  students: AdminStudentRow[];
  batchOptions: BatchOption[];
  onDeleted: (id: string) => void;
  onStatusChanged?: (id: string, next: StudentStatus) => void;
  emptyMessage: string;
}) {
  if (students.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
          <GraduationCap className="h-6 w-6" strokeWidth={2} />
        </span>
        <p className="mt-4 text-sm font-medium text-navy/60">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-navy/10 bg-white">
      <table className="w-full min-w-[1220px] text-left text-sm">
        <thead>
          <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
            <th className="px-4 py-3">Student</th>
            <th className="px-4 py-3">Fees</th>
            <th className="px-4 py-3">Enrollment ID</th>
            <th className="px-4 py-3">Phase</th>
            <th className="px-4 py-3">Country</th>
            <th className="px-4 py-3">Enrolled</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Portal Password</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.id}
              className="border-b border-navy/5 transition-colors last:border-0 hover:bg-cream-dim/60"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/students/${student.id}`}
                  className="font-semibold text-navy hover:text-red-dark hover:underline"
                >
                  {student.full_name}
                </Link>
                <p className="text-xs text-navy/50">{student.email}</p>
                <p className="text-xs text-navy/50">{student.phone}</p>
              </td>
              <td className="px-4 py-3">
                <FeesCell student={student} />
              </td>
              <td className="px-4 py-3 font-display text-xs font-bold text-navy/70">
                {student.enrollment_ref}
              </td>
              <td className="px-4 py-3 text-navy/70">
                <CourseCell student={student} batchOptions={batchOptions} />
              </td>
              <td className="px-4 py-3 text-navy/70">{student.country}</td>
              <td className="px-4 py-3 text-navy/50">{formatDate(student.enrolled_at)}</td>
              <td className="px-4 py-3">
                <StatusCell student={student} onStatusChanged={onStatusChanged} />
              </td>
              <td className="px-4 py-3">
                <PasswordCell student={student} />
              </td>
              <td className="px-4 py-3">
                <DeleteCell student={student} onDeleted={onDeleted} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
