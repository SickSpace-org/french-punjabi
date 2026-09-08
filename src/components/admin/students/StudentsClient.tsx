"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, GraduationCap, Search, Send } from "lucide-react";
import type { AdminStudentRow } from "@/lib/courses/getAdminStudents";
import {
  sendPasswordToStudent,
  setStudentStatus,
  type StudentStatus,
} from "@/app/admin/(dashboard)/students/[studentId]/actions";
import { useToast } from "@/components/admin/ToastProvider";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUSPENDED: "border-red/20 bg-red-soft text-red-dark",
  INACTIVE: "border-navy/15 bg-navy/5 text-navy/50",
};

const STATUS_OPTIONS: StudentStatus[] = ["ACTIVE", "SUSPENDED", "INACTIVE"];

function StatusCell({ student }: { student: AdminStudentRow }) {
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

export default function StudentsClient({ initialStudents }: { initialStudents: AdminStudentRow[] }) {
  const [students] = useState(initialStudents);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.enrollment_ref.toLowerCase().includes(q)
    );
  }, [students, search]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Students</h1>
      <p className="mt-1 text-sm text-navy/60">
        Appears here automatically once an admin confirms an enrollment&apos;s Interac e-Transfer. Any
        ACTIVE student sees every published course — click a student to manage their portal login or
        suspend/reactivate them.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:w-64">
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Total Students
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-navy">{students.length}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or enrollment ID"
            className="w-full rounded-xl border border-navy/15 bg-white py-2.5 pl-10 pr-4 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <GraduationCap className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">
            {students.length === 0
              ? "No students yet — they appear here once payment is confirmed for an enrollment."
              : "No students match your search."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Enrollment ID</th>
                <th className="px-4 py-3">Phase</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Portal Password</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
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
                  <td className="px-4 py-3 font-display text-xs font-bold text-navy/70">
                    {student.enrollment_ref}
                  </td>
                  <td className="px-4 py-3 text-navy/70">{student.phase_label ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/70">{student.country}</td>
                  <td className="px-4 py-3 text-navy/50">{formatDate(student.enrolled_at)}</td>
                  <td className="px-4 py-3">
                    <StatusCell student={student} />
                  </td>
                  <td className="px-4 py-3">
                    <PasswordCell student={student} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
