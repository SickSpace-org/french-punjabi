/** 0=Sunday .. 6=Saturday, matching Postgres extract(dow from ...) and JS Date#getDay(). */
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const ATTENDANCE_WINDOW_DAYS = 28;

/**
 * Every batch runs on Toronto time (batches.timezone, and the check-in
 * window in mark_class_attendance(), supabase/068_attendance_toronto_dates.sql),
 * so "today" and every class date here are Toronto calendar dates — never
 * the server's clock (Vercel runs in UTC, where an 8 PM Toronto class is
 * already tomorrow) or the viewer's browser clock.
 */
export const CLASS_TIME_ZONE = "America/Toronto";

/** Students can check in from this long before class_time (same ±30 min as mark_class_attendance()). */
const CHECK_IN_OPENS_MINUTES_BEFORE = 30;

/** Toronto wall-clock date ("YYYY-MM-DD") and minutes since midnight, right now. */
function torontoNow(): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: CLASS_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Today's Toronto calendar date, "YYYY-MM-DD" — the class_date a check-in right now is saved under. */
export function torontoTodayStr(): string {
  return torontoNow().date;
}

/** Today's Toronto calendar date as a UTC-midnight Date, so getUTCDay()/toISOString() read back that same date. */
function torontoToday(): Date {
  return new Date(`${torontoNow().date}T00:00:00Z`);
}

/** "HH:MM[:SS]" → minutes since midnight, or null if unset/unparseable. */
function clockMinutes(classTime: string | null | undefined): number | null {
  const match = classTime?.match(/^(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Every scheduled class date (today or earlier) in the last `days` days,
 * ascending — the same window the admin/teacher attendance grids and a
 * student's own history use, so "present" vs "absent" always means the same
 * thing everywhere.
 *
 * Today's class is only included once its check-in window has opened (30 min
 * before `classTime`, Toronto time) — before that it hasn't happened yet, so
 * listing it would show every student as Absent all day. Without a
 * classTime, today is included as soon as it's a class day.
 */
export function scheduledDatesInWindow(
  classDays: number[],
  days: number = ATTENDANCE_WINDOW_DAYS,
  classTime: string | null = null
): string[] {
  if (classDays.length === 0) return [];

  const now = torontoNow();
  const startMinutes = clockMinutes(classTime);
  const todayStarted = startMinutes === null || now.minutes >= startMinutes - CHECK_IN_OPENS_MINUTES_BEFORE;

  const dates: string[] = [];
  const today = torontoToday();
  for (let i = days - 1; i >= 0; i--) {
    if (i === 0 && !todayStarted) continue;
    const d = addDays(today, -i);
    if (classDays.includes(d.getUTCDay())) {
      dates.push(toDateStr(d));
    }
  }
  return dates;
}

export function isClassDayToday(classDays: number[]): boolean {
  return classDays.includes(torontoToday().getUTCDay());
}

/**
 * The next scheduled class date strictly after today (never today itself —
 * callers already have isClassDayToday for that), up to a week out. Null if
 * the batch has no schedule set. Returned as midday Toronto time on that
 * date (an instant, for formatInstantWeekdayShort, which formats in Toronto),
 * so the weekday shown is right for a viewer in any time zone.
 */
export function nextClassDateAfterToday(classDays: number[]): Date | null {
  if (classDays.length === 0) return null;
  const today = torontoToday();
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, i);
    if (classDays.includes(d.getUTCDay())) {
      // 17:00 UTC is 12:00 EST / 13:00 EDT — the same Toronto date either way.
      return new Date(`${toDateStr(d)}T17:00:00Z`);
    }
  }
  return null;
}

export function dayLabel(dateStr: string): string {
  return DAY_LABELS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
}

/** "Mon, Wed · 20:00:00" / "Schedule not set yet" — shared by the Teacher Portal's dashboard and attendance pages so this formatting exists in one place. */
export function formatSchedule(classDays: number[], classTime: string | null): string {
  if (classDays.length === 0) return "Schedule not set yet";
  const days = [...classDays].sort().map((d) => DAY_LABELS[d]).join(", ");
  return classTime ? `${days} · ${classTime}` : days;
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
