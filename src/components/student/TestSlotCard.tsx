"use client";

import type { UpcomingTestSlot } from "@/lib/student/getUpcomingTestSlot";
import { isClassDayToday } from "@/lib/attendance/schedule";

const FRIDAY = 5;

function formatTime(startTime: string) {
  const [hourStr, minuteStr] = startTime.split(":");
  const hour24 = Number(hourStr);
  const minute = Number(minuteStr);
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${isPm ? "PM" : "AM"}`;
}

/**
 * Dashboard summary for the weekly mock test slot admins set on
 * /admin/test-slots (supabase/023_test_slots.sql) — always Friday, so
 * reuses the same isClassDayToday helper as NextClassCard with a fixed
 * [FRIDAY] day array instead of a batch's class_days. The Join Test button
 * only ever appears on Friday itself; every other day it just says the test
 * is on Friday. Joining just opens the meeting link — no attendance tracking.
 * Plain text only (no icons) here by design.
 */
export default function TestSlotCard({ slot }: { slot: UpcomingTestSlot | null }) {
  if (!slot) return null;

  const today = isClassDayToday([FRIDAY]);
  const timeText = formatTime(slot.startTime);

  return (
    <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Weekly Test Slot</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-navy">
            {slot.title} ({slot.durationMinutes} min)
          </p>
          <p className="text-xs text-navy/50">
            {today ? `Today, ${timeText}` : `Test will be on Friday, ${timeText}`}
          </p>
          {slot.note ? <p className="mt-0.5 text-xs text-navy/40">{slot.note}</p> : null}
        </div>

        {today && slot.meetingLink ? (
          <a
            href={slot.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark hover:shadow-md"
          >
            Join Test
          </a>
        ) : null}
      </div>
    </div>
  );
}
