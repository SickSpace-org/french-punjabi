"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AdminStudentRow } from "@/lib/courses/getAdminStudents";
import StudentsTable, { type BatchOption } from "@/components/admin/students/StudentsTable";
import StudentFilters from "@/components/admin/students/StudentFilters";

export default function StudentsClient({
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
    // This page only ever shows active/suspended students — once one goes
    // INACTIVE it belongs on the separate Inactive Students page instead.
    if (next === "INACTIVE") {
      setStudents((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const activeStudents = useMemo(() => students.filter((s) => s.status !== "INACTIVE"), [students]);
  const inactiveCount = students.length - activeStudents.length;

  const batchLabelById = useMemo(() => new Map(batchOptions.map((b) => [b.id, b.label])), [batchOptions]);

  const phaseOptions = useMemo(
    () =>
      Array.from(new Set(activeStudents.map((s) => s.current_phase_name).filter((v): v is string => !!v))).sort(),
    [activeStudents]
  );
  const levelOptions = useMemo(
    () =>
      Array.from(new Set(activeStudents.map((s) => s.current_level_name).filter((v): v is string => !!v))).sort(),
    [activeStudents]
  );
  const batchFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          activeStudents
            .map((s) => (s.current_batch_id ? batchLabelById.get(s.current_batch_id) : null))
            .filter((v): v is string => !!v)
        )
      ).sort(),
    [activeStudents, batchLabelById]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeStudents.filter((s) => {
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
  }, [activeStudents, search, phaseFilter, levelFilter, batchFilter, batchLabelById]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Students</h1>
      <p className="mt-1 text-sm text-navy/60">
        Appears here automatically once an admin confirms an enrollment&apos;s Interac e-Transfer. Any
        ACTIVE student sees every published course — click a student to manage their portal login or
        suspend/reactivate them. Setting a student to INACTIVE moves them off this page onto the separate
        Inactive Students page.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:w-64">
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Active Students
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-navy">{activeStudents.length}</p>
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
        extra={
          <Link
            href="/admin/students/inactive"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/60 hover:text-red-dark"
          >
            Inactive Students ({inactiveCount})
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        }
      />

      <StudentsTable
        students={filtered}
        batchOptions={batchOptions}
        onDeleted={handleDeleted}
        onStatusChanged={handleStatusChanged}
        emptyMessage={
          activeStudents.length === 0
            ? "No students yet — they appear here once payment is confirmed for an enrollment."
            : "No active students match your search/filters."
        }
      />
    </div>
  );
}
