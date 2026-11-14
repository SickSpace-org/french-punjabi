/** Matches SESSION_MINUTES in data/personalisedOneOnOne.ts; kept local so this file has no path-alias imports and can be unit-tested directly by node. */
const SESSION_MINUTES = 30;

export type GeneratedSlot = {
  /** "12:30 PM – 1:00 PM" — shown to students and stored as the batch's time_label. */
  label: string;
  /** "12:30:00" — the batch's class_time, which the attendance check-in window is centred on. */
  classTime: string;
};

function toMinutes(hhmm: string): number | null {
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function formatClock(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatClassTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/**
 * Splits [start, end) into back-to-back sessions, e.g. 12:00 to 14:00 gives
 * 12:00-12:30, 12:30-1:00, 1:00-1:30, 1:30-2:00. Inputs are 24-hour "HH:MM"
 * (the format of <input type="time">). Returns null when either time is
 * invalid or the range doesn't fit a single session; trailing time shorter
 * than one session is dropped.
 */
export function generateSlots(start: string, end: string, sessionMinutes: number = SESSION_MINUTES): GeneratedSlot[] | null {
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null) return null;
  if (endMin - startMin < sessionMinutes) return null;

  const slots: GeneratedSlot[] = [];
  for (let t = startMin; t + sessionMinutes <= endMin; t += sessionMinutes) {
    slots.push({
      label: `${formatClock(t)} – ${formatClock(t + sessionMinutes)}`,
      classTime: formatClassTime(t),
    });
  }
  return slots;
}
