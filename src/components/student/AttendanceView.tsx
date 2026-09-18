"use client";

import { useState } from "react";
import { CalendarCheck, ExternalLink, Video } from "lucide-react";
import { markClassAttendance } from "@/app/student/actions";
import type { CurrentBatchInfo } from "@/lib/student/getCurrentBatch";
import type { AttendanceDay } from "@/lib/student/getMyAttendance";
import { DAY_LABELS, dayLabel, isClassDayToday } from "@/lib/attendance/schedule";
import { useToast } from "@/components/admin/ToastProvider";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function AttendanceView({
  batch,
  history,
}: {
  batch: CurrentBatchInfo | null;
  history: AttendanceDay[];
}) {
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);
  const [markedToday, setMarkedToday] = useState(
    history.length > 0 && history[0].present && history[0].date === new Date().toISOString().slice(0, 10)
  );

  const classToday = batch ? isClassDayToday(batch.classDays) : false;

  const handleJoin = () => {
    if (!batch?.meetingLink) return;
    window.open(batch.meetingLink, "_blank", "noopener,noreferrer");
    setJoining(true);
    markClassAttendance(batch.batchId)
      .then((result) => {
        setJoining(false);
        if (result.ok) {
          setMarkedToday(true);
          showToast(result.alreadyMarked ? "You're already marked present for today." : "Marked present for today.");
        } else {
          showToast(result.error, "error");
        }
      })
      .catch(() => setJoining(false));
  };

  return (
    <div>
      <p className="font-display text-2xl font-bold text-navy">Attendance</p>
      <p className="mt-1 text-sm text-navy/60">
        Click Join Class within 30 minutes of your class start time on a scheduled day and
        you&apos;re automatically marked present.
      </p>

      <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
        {!batch ? (
          <p className="text-sm text-navy/50">
            No batch assigned yet. Once your enrollment is confirmed and a batch is assigned, your
            class schedule will appear here.
          </p>
        ) : batch.classDays.length === 0 ? (
          <p className="text-sm text-navy/50">Your batch&apos;s class schedule hasn&apos;t been set yet.</p>
        ) : !classToday ? (
          <div>
            <p className="text-sm font-semibold text-navy">No class today</p>
            <p className="mt-1 text-xs text-navy/50">
              Your batch meets on {batch.classDays.map((d) => DAY_LABELS[d]).join(", ")} at{" "}
              {batch.timeLabel} {batch.timezone}.
            </p>
          </div>
        ) : !batch.meetingLink ? (
          <p className="text-sm text-navy/50">
            Today&apos;s a class day, but your teacher hasn&apos;t added a meeting link yet — check back
            shortly before class.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-soft text-red-dark">
                <Video className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">Class is today</p>
                <p className="text-xs text-navy/50">
                  {batch.timeLabel} {batch.timezone}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide shadow-sm transition-all duration-300 disabled:cursor-default ${
                markedToday
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red text-white shadow-red/30 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-md"
              }`}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={2} />
              {joining ? "Joining…" : markedToday ? "Joined — Present" : "Join Class"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Your History</p>

        {history.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
              <CalendarCheck className="h-6 w-6" strokeWidth={2} />
            </span>
            <p className="mt-4 text-sm font-medium text-navy/60">No class history yet.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-navy/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((day) => (
                  <tr key={day.date} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3 text-navy/70">
                      {formatDate(day.date)}
                      <span className="ml-1 text-xs text-navy/40">({dayLabel(day.date)})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                          day.present
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red/20 bg-red-soft text-red-dark"
                        }`}
                      >
                        {day.present ? "Present" : "Absent"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
