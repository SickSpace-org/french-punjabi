"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import type { AdminStudentRow } from "@/lib/courses/getAdminStudents";
import StudentsTable, { type BatchOption } from "@/components/admin/students/StudentsTable";

export default function InactiveStudentsClient({
  initialStudents,
  batchOptions,
}: {
  initialStudents: AdminStudentRow[];
  batchOptions: BatchOption[];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState("");

  const handleDeleted = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleStatusChanged = (id: string, next: string) => {
    // This page only ever shows INACTIVE students — reactivating/suspending
    // one moves it back onto the main Students page instead.
    if (next !== "INACTIVE") {
      setStudents((prev) => prev.filter((s) => s.id !== id));
    }
  };

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
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/60 hover:text-red-dark"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Back to Students
      </Link>

      <h1 className="mt-3 font-display text-2xl font-bold text-navy">Inactive Students</h1>
      <p className="mt-1 text-sm text-navy/60">
        Students set to INACTIVE from the main Students page. They&apos;re hidden from the main list and
        kept here until reactivated. Change a student&apos;s status back to ACTIVE or SUSPENDED to move
        them back.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:w-64">
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Inactive Students
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-navy">{students.length}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px] sm:max-w-sm">
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

      <StudentsTable
        students={filtered}
        batchOptions={batchOptions}
        onDeleted={handleDeleted}
        onStatusChanged={handleStatusChanged}
        emptyMessage={
          students.length === 0
            ? "No inactive students — students moved here when their status is set to INACTIVE."
            : "No inactive students match your search."
        }
      />
    </div>
  );
}
