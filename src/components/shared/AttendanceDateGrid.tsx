"use client";

import { useState } from "react";
import { ATTENDANCE_WINDOW_DAYS, dayLabel } from "@/lib/attendance/schedule";
import { setAttendanceStatus } from "@/app/admin/(dashboard)/courses/actions";
import { useToast } from "@/components/admin/ToastProvider";

// Pinned locale (not `undefined`) — this renders during SSR too (it's part
// of a Client Component's initial output), and an unpinned locale can
// resolve differently between the server's ICU default and the browser's,
// producing a hydration mismatch ("Sep 1" vs "1 Sept").
function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

/**
 * Click-to-toggle P/A date-chip grid for one student in one batch — used
 * by the admin Student detail page and the Teacher Portal's attendance
 * page. Both roles call the exact same setAttendanceStatus server action;
 * RLS (attendance_admin_write / attendance_teacher_write, see
 * supabase/019_attendance_time_window_and_admin_override.sql /
 * 033_teacher_attendance_access.sql) is what actually decides whether the
 * write is allowed for the caller's session — this component has no idea
 * which role is using it, on purpose, so there is exactly one code path
 * that ever writes an attendance row.
 */
export default function AttendanceDateGrid({
  studentId,
  batchId,
  classDates,
  presentDates: initialPresentDates,
  totalCount,
}: {
  studentId: string;
  batchId: string;
  classDates: string[];
  presentDates: string[];
  totalCount: number;
}) {
  const { showToast } = useToast();
  const [presentDates, setPresentDates] = useState<Set<string>>(() => new Set(initialPresentDates));
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

    const result = await setAttendanceStatus(studentId, batchId, date, nextPresent);
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

  const presentCount = classDates.filter((d) => presentDates.has(d)).length;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="font-display text-xl font-bold text-navy">
          {presentCount}
          <span className="text-navy/40"> / {totalCount}</span>
        </p>
        <p className="text-xs text-navy/50">classes attended in the last {ATTENDANCE_WINDOW_DAYS} days</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {classDates.map((date) => {
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
