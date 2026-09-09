"use client";

import type { MyTestSlot } from "@/lib/student/getMyTestSlot";
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

export default function TestSlotView({ slot }: { slot: MyTestSlot | null }) {
  const today = isClassDayToday([FRIDAY]);

  return (
    <div>
      <p className="font-display text-2xl font-bold text-navy">Test</p>
      <p className="mt-1 text-sm text-navy/60">
        Your weekly mock test is every Friday, at the time your teacher assigns you below.
      </p>

      <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
        {!slot ? (
          <p className="text-sm text-navy/50">
            Your teacher hasn&apos;t assigned you a Friday test time yet — check back soon.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-navy">
                {today ? "Your test is today" : "Your test time"}
              </p>
              <p className="mt-1 text-xs text-navy/50">
                {today ? "Today" : "Every Friday"}, {formatTime(slot.startTime)}
              </p>
              {slot.note ? <p className="mt-1 text-xs text-navy/40">{slot.note}</p> : null}
              {!slot.meetingLink ? (
                <p className="mt-1 text-xs text-red-dark">
                  No meeting link set yet — check back shortly before your test.
                </p>
              ) : null}
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
        )}
      </div>
    </div>
  );
}
