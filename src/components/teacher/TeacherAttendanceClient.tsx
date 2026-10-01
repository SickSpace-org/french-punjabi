"use client";

import { CalendarClock, ExternalLink, GraduationCap } from "lucide-react";
import type { TeacherAttendanceBatch } from "@/lib/teachers/getTeacherAttendance";
import { formatSchedule } from "@/lib/attendance/schedule";
import AttendanceDateGrid from "@/components/shared/AttendanceDateGrid";

// Pinned locale — see the same comment in AttendanceDateGrid.tsx (avoids a server/client hydration mismatch).
function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function TeacherAttendanceClient({ batches }: { batches: TeacherAttendanceBatch[] }) {
  if (batches.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
          <GraduationCap className="h-6 w-6" strokeWidth={2} />
        </span>
        <p className="mt-4 text-sm font-medium text-navy/60">No batches assigned yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      {batches.map((batch) => (
        <div key={batch.batchId} className="rounded-2xl border border-navy/10 bg-white p-5">
          <p className="font-display text-base font-bold text-navy">{batch.label}</p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-navy/50">
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
            {formatSchedule(batch.classDays, batch.classTime)}
          </p>
          {batch.meetingLink ? (
            <a
              href={batch.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-red-dark hover:underline"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={2} />
              Class meeting link
            </a>
          ) : null}

          <div className="mt-4 space-y-4 border-t border-navy/10 pt-4">
            {batch.students.length === 0 ? (
              <p className="text-sm text-navy/50">No students enrolled in this batch yet.</p>
            ) : (
              batch.students.map((student) => (
                <div key={student.studentId} className="rounded-xl border border-navy/10 p-4">
                  <p className="text-sm font-semibold text-navy">{student.fullName}</p>
                  <div className="mt-2">
                    {batch.hasSchedule ? (
                      batch.classDates.length > 0 ? (
                        <AttendanceDateGrid
                          studentId={student.studentId}
                          batchId={batch.batchId}
                          classDates={batch.classDates}
                          presentDates={student.presentDates}
                          totalCount={batch.classDates.length}
                        />
                      ) : (
                        <p className="text-sm text-navy/50">No classes scheduled in this window yet.</p>
                      )
                    ) : (
                      <>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <p className="font-display text-xl font-bold text-navy">{student.presentDates.length}</p>
                          <p className="text-xs text-navy/50">classes attended (ever) — no weekly schedule set yet</p>
                        </div>
                        {student.presentDates.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {student.presentDates.map((date) => (
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
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
