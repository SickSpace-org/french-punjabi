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

export function dayLabel(dateStr: string): string {
  return DAY_LABELS[new Date(`${dateStr}T00:00:00`).getDay()];
}
