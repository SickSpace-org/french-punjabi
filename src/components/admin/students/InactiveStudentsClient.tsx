"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { AdminStudentRow } from "@/lib/courses/getAdminStudents";
import StudentsTable, { type BatchOption } from "@/components/admin/students/StudentsTable";
import StudentFilters from "@/components/admin/students/StudentFilters";

export default function InactiveStudentsClient({
  initialStudents,
  batchOptions,
}: {
  initialStudents: AdminStudentRow[];
  batchOptions: BatchOption[];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");

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

  const batchLabelById = useMemo(() => new Map(batchOptions.map((b) => [b.id, b.label])), [batchOptions]);

  const phaseOptions = useMemo(
    () => Array.from(new Set(students.map((s) => s.current_phase_name).filter((v): v is string => !!v))).sort(),
    [students]
  );
  const levelOptions = useMemo(
    () => Array.from(new Set(students.map((s) => s.current_level_name).filter((v): v is string => !!v))).sort(),
    [students]
  );
  const batchFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((s) => (s.current_batch_id ? batchLabelById.get(s.current_batch_id) : null))
            .filter((v): v is string => !!v)
        )
      ).sort(),
    [students, batchLabelById]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (phaseFilter !== "all" && s.current_phase_name !== phaseFilter) return false;
      if (levelFilter !== "all" && s.current_level_name !== levelFilter) return false;
      if (batchFilter !== "all") {
        const label = s.current_batch_id ? batchLabelById.get(s.current_batch_id) : null;
        if (label !== batchFilter) return false;
      }
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.enrollment_ref.toLowerCase().includes(q)
      );
    });
  }, [students, search, phaseFilter, levelFilter, batchFilter, batchLabelById]);

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

      <StudentFilters
        search={search}
        onSearchChange={setSearch}
        phaseFilter={phaseFilter}
        onPhaseFilterChange={setPhaseFilter}
        phaseOptions={phaseOptions}
        levelFilter={levelFilter}
        onLevelFilterChange={setLevelFilter}
        levelOptions={levelOptions}
        batchFilter={batchFilter}
        onBatchFilterChange={setBatchFilter}
        batchOptions={batchFilterOptions}
      />

      <StudentsTable
        students={filtered}
        batchOptions={batchOptions}
        onDeleted={handleDeleted}
        onStatusChanged={handleStatusChanged}
        emptyMessage={
          students.length === 0
            ? "No inactive students — students moved here when their status is set to INACTIVE."
            : "No inactive students match your search/filters."
        }
      />
    </div>
  );
}
