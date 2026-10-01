"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, GraduationCap, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AdminTeacherRow } from "@/lib/teachers/getAdminTeachers";
import { addTeacher, deactivateTeacher, reactivateTeacher } from "@/app/admin/(dashboard)/teachers/actions";
import { useToast } from "@/components/admin/ToastProvider";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DEACTIVATED: "border-navy/15 bg-navy/5 text-navy/50",
};

function AddTeacherForm() {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await addTeacher(fullName, email);
      if (result.ok) {
        setFullName("");
        setEmail("");
        showToast(
          result.inviteMode === "created"
            ? "Teacher added — login credentials emailed."
            : "Teacher added — this email already had an account, linked it instead (no new email was sent)."
        );
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-navy/10 bg-white p-5"
    >
      <div className="min-w-0 flex-1">
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Full Name</label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Priya Kaur"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div className="min-w-0 flex-1">
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teacher@example.com"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-red px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        {pending ? "Adding…" : "Add Teacher"}
      </button>
    </form>
  );
}

function TeacherCard({ teacher }: { teacher: AdminTeacherRow }) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [batchesOpen, setBatchesOpen] = useState(false);
  const batchCount = teacher.assignedBatches.length;

  const handleToggleStatus = () => {
    startTransition(async () => {
      const result =
        teacher.status === "ACTIVE" ? await deactivateTeacher(teacher.id) : await reactivateTeacher(teacher.id);
      if (!result.ok) showToast(result.error, "error");
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy/10 bg-white px-4 py-3">
      <div className="min-w-0">
        <Link href={`/admin/teachers/${teacher.id}`} className="text-sm font-semibold text-navy hover:text-red-dark hover:underline">
          {teacher.full_name}
        </Link>
        <p className="truncate text-xs text-navy/50">{teacher.email}</p>
        <button
          type="button"
          onClick={() => setBatchesOpen((v) => !v)}
          disabled={batchCount === 0}
          className="mt-0.5 inline-flex items-center gap-1 text-xs text-navy/50 hover:text-navy/70 disabled:cursor-default disabled:text-navy/35 disabled:hover:text-navy/35"
        >
          {batchCount === 0 ? "No batches assigned yet" : `${batchCount} batch${batchCount === 1 ? "" : "es"} assigned`}
          {batchCount > 0 ? (
            <ChevronDown
              className={`h-3 w-3 transition-transform ${batchesOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          ) : null}
        </button>
        {batchesOpen && batchCount > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {teacher.assignedBatches.map((b) => (
              <li
                key={b.batchId}
                className="rounded-full border border-navy/15 bg-cream-dim px-2.5 py-1 text-[11px] font-semibold text-navy"
              >
                {b.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            STATUS_STYLES[teacher.status] ?? STATUS_STYLES.DEACTIVATED
          }`}
        >
          {teacher.status}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={handleToggleStatus}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
            teacher.status === "ACTIVE"
              ? "border-red/20 bg-white text-red hover:bg-red-soft"
              : "border-navy/15 bg-white text-navy hover:bg-cream-dim"
          }`}
        >
          {teacher.status === "ACTIVE" ? (
            <>
              <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
              Deactivate
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Reactivate
            </>
          )}
        </button>
        <Link
          href={`/admin/teachers/${teacher.id}`}
          className="rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim"
        >
          Manage
        </Link>
      </div>
    </div>
  );
}

export default function TeachersClient({ initialTeachers }: { initialTeachers: AdminTeacherRow[] }) {
  const teachers = initialTeachers;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Teachers</h1>
      <p className="mt-1 text-sm text-navy/60">
        Add teachers, assign them to batches on the Courses page, and track payments/hours from a
        teacher&apos;s own page. Deactivating pauses their portal login without losing any history —
        Remove (on their own page) permanently deletes the account.
      </p>

      <div className="mt-6">
        <AddTeacherForm />
      </div>

      {teachers.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <GraduationCap className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">No teachers yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {teachers.map((teacher) => (
            <TeacherCard key={teacher.id} teacher={teacher} />
          ))}
        </div>
      )}
    </div>
  );
}
