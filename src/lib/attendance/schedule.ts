/** 0=Sunday .. 6=Saturday, matching Postgres extract(dow from ...) and JS Date#getDay(). */
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const ATTENDANCE_WINDOW_DAYS = 28;

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Every scheduled class date (today or earlier) in the last `days` days,
 * ascending — the same window both the admin attendance grid
 * (getAdminAttendance.ts) and a student's own history (getMyAttendance.ts)
 * use, so "present" vs "absent" always means the same thing in both places.
 */
export function scheduledDatesInWindow(classDays: number[], days: number = ATTENDANCE_WINDOW_DAYS): string[] {
  if (classDays.length === 0) return [];

  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (classDays.includes(d.getDay())) {
      dates.push(toDateStr(d));
    }
  }
  return dates;
}

export function isClassDayToday(classDays: number[]): boolean {
  return classDays.includes(new Date().getDay());
}

/**
 * The next scheduled class date strictly after today (never today itself —
 * callers already have isClassDayToday for that), up to a week out. Null if
 * the batch has no schedule set.
 */
export function nextClassDateAfterToday(classDays: number[]): Date | null {
  if (classDays.length === 0) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (classDays.includes(d.getDay())) return d;
  }
  return null;
}

export function dayLabel(dateStr: string): string {
  return DAY_LABELS[new Date(`${dateStr}T00:00:00`).getDay()];
}

/**
 * Best-effort parse of a batch's free-text time_label (e.g. "8:30 AM",
 * "10:00 PM") into a "HH:MM:SS" clock time — used to default a new batch's
 * class_time to its own displayed time instead of leaving the attendance
 * check-in window unset. Returns null for anything that isn't exactly
 * "H:MM AM/PM" (e.g. "Morning Timing"), which the admin then sets by hand.
 */
export function parseTimeLabelToClockTime(timeLabel: string): string | null {
  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour12 < 1 || hour12 > 12 || minute > 59) return null;

  const isPm = match[3].toUpperCase() === "PM";
  let hour24 = hour12 % 12;
  if (isPm) hour24 += 12;

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}
