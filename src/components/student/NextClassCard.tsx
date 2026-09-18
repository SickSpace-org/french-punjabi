"use client";

import { useState } from "react";
import { ExternalLink, Video } from "lucide-react";
import { markClassAttendance } from "@/app/student/actions";
import type { CurrentBatchInfo } from "@/lib/student/getCurrentBatch";
import { DAY_LABELS, isClassDayToday, nextClassDateAfterToday } from "@/lib/attendance/schedule";
import { useToast } from "@/components/admin/ToastProvider";

function formatNextClassDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/**
 * Dashboard-level "what's next" summary — course name, schedule, and the
 * meeting link, with no attendance history/status UI (that's what the
 * dedicated Attendance page is for). Joining from here still calls
 * mark_class_attendance() so it counts the same as joining from there.
 */
export default function NextClassCard({ batch }: { batch: CurrentBatchInfo | null }) {
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);

  if (!batch) return null;

  const hasSchedule = batch.classDays.length > 0;
  const classToday = hasSchedule && isClassDayToday(batch.classDays);
  const nextDate = hasSchedule && !classToday ? nextClassDateAfterToday(batch.classDays) : null;

  const handleJoin = () => {
    if (!batch.meetingLink) return;
    window.open(batch.meetingLink, "_blank", "noopener,noreferrer");
    setJoining(true);
    markClassAttendance(batch.batchId)
      .then((result) => {
        setJoining(false);
        if (result.ok && !result.alreadyMarked) {
          showToast("Marked present for today.");
        } else if (!result.ok) {
          showToast(result.error, "error");
        }
      })
      .catch(() => setJoining(false));
  };

  return (
    <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Next Class</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-soft text-red-dark">
            <Video className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy">{batch.courseName}</p>
            <p className="text-xs text-navy/50">
              {!hasSchedule
                ? "Class schedule hasn't been set yet."
                : classToday
                  ? `Today, ${batch.timeLabel} ${batch.timezone}`
                  : nextDate
                    ? `Next class: ${formatNextClassDate(nextDate)}, ${batch.timeLabel} ${batch.timezone}`
                    : `${batch.classDays.map((d) => DAY_LABELS[d]).join(", ")} · ${batch.timeLabel} ${batch.timezone}`}
            </p>
          </div>
        </div>

        {classToday && batch.meetingLink ? (
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="inline-flex items-center gap-2 rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-md disabled:cursor-default"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
            {joining ? "Joining…" : "Join Class"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
