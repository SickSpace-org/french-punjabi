"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, Search } from "lucide-react";
import type { AdminStudentRow } from "@/lib/courses/getAdminStudents";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUSPENDED: "border-red/20 bg-red-soft text-red-dark",
  INACTIVE: "border-navy/15 bg-navy/5 text-navy/50",
};

export default function StudentsClient({ initialStudents }: { initialStudents: AdminStudentRow[] }) {
  const [students] = useState(initialStudents);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");

  const courseOptions = useMemo(() => {
    const names = new Set<string>();
    students.forEach((s) => s.courses.forEach((c) => names.add(c.courseTitle)));
    return Array.from(names).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (courseFilter !== "all" && !s.courses.some((c) => c.courseTitle === courseFilter)) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.enrollment_ref.toLowerCase().includes(q)
      );
    });
  }, [students, search, courseFilter]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Students</h1>
      <p className="mt-1 text-sm text-navy/60">
        Appears here automatically once an admin confirms an enrollment&apos;s Interac e-Transfer.
        Click a student to manage their course access.
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
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10"
        >
          <option value="all">All Courses</option>
          {courseOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <GraduationCap className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">
            {students.length === 0
              ? "No students yet — they appear here once payment is confirmed for an enrollment."
              : "No students match your search/filters."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Enrollment ID</th>
                <th className="px-4 py-3">Assigned Courses</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Status</th>
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
                  <td className="px-4 py-3 text-navy/70">
                    {student.courses.length === 0 ? (
                      <span className="text-navy/40">None assigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {student.courses.map((c) => (
                          <span
                            key={c.accessId}
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              c.status === "ACTIVE"
                                ? "border-navy/15 bg-cream-dim text-navy/70"
                                : "border-navy/10 bg-navy/5 text-navy/35 line-through"
                            }`}
                          >
                            {c.courseTitle}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy/70">{student.country}</td>
                  <td className="px-4 py-3 text-navy/50">{formatDate(student.enrolled_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        STATUS_STYLES[student.status] ?? STATUS_STYLES.INACTIVE
                      }`}
                    >
                      {student.status}
                    </span>
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
