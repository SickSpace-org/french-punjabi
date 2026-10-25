/**
 * Single source of truth for every date/time string this app renders in
 * React, specifically to prevent server/client hydration mismatches: any
 * call that omits a locale (`undefined`) or that different files pinned to
 * different locales ("en-CA" in some, nothing in others) renders
 * differently depending on the Node server's ICU default vs. whichever
 * locale the visiting browser happens to be configured with — e.g. "Oct 4,
 * 2026" vs. "4 Oct 2026" for the exact same date. Every export here pins
 * "en-US" explicitly, so the string is identical regardless of where it
 * renders.
 *
 * Two genuinely different kinds of input, handled differently on purpose:
 *
 * - Date-ONLY values ("YYYY-MM-DD", e.g. a class_date or attendance day)
 *   have no real time component. These are parsed as LOCAL midnight (no
 *   "Z"/offset) and formatted WITHOUT a `timeZone` override — parsing and
 *   formatting then always happen in the same environment's local zone,
 *   so the calendar date can never shift by a day no matter which
 *   timezone the server or the browser happens to be running in. Passing
 *   an explicit `timeZone` here would be the bug the locale fix is meant
 *   to avoid trading for a different one: it can shift the displayed day
 *   backward or forward depending on the gap between the parsing
 *   environment's local offset and the one requested.
 *
 * - Full timestamps (real ISO datetimes with an actual moment in time —
 *   enrolled_at, created_at, changed_at, a computed next-class instant)
 *   DO get an explicit `timeZone: "America/Toronto"`, since classes are
 *   scheduled in EST/EDT and the business itself operates out of Canada —
 *   admin- and student-facing timestamps should read in the business's
 *   own local time, not whatever zone the server or visitor happens to be
 *   in. "America/Toronto" (an IANA zone, not a fixed UTC offset) also
 *   handles the EST/EDT daylight-saving transition correctly on its own.
 */

const LOCALE = "en-US";
const TIME_ZONE = "America/Toronto";

/** Date-only, e.g. "Oct 4, 2026". Input: "YYYY-MM-DD". */
export function formatDateOnlyMedium(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString(LOCALE, { dateStyle: "medium" });
}

/** Date-only, short, e.g. "Oct 4". Input: "YYYY-MM-DD". */
export function formatDateOnlyShort(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString(LOCALE, { month: "short", day: "numeric" });
}

/** Date-only, with weekday, e.g. "Sun, Oct 4". Input: "YYYY-MM-DD". */
export function formatDateOnlyWeekdayShort(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString(LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Full timestamp, e.g. "Oct 4, 2026". Input: an ISO datetime string. */
export function formatTimestampMedium(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { dateStyle: "medium", timeZone: TIME_ZONE });
}

/** Full timestamp with time, e.g. "Oct 4, 2026, 2:30 PM". Input: an ISO datetime string. */
export function formatTimestampMediumWithTime(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
}

/** Full timestamp, year/month/day, e.g. "Oct 4, 2026". Input: an ISO datetime string. */
export function formatTimestampYearMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TIME_ZONE,
  });
}

/** Full timestamp with weekday, e.g. "Sunday, Oct 4". Input: a real Date (a computed instant, e.g. "next class occurs at"). */
export function formatInstantWeekdayShort(instant: Date): string {
  return instant.toLocaleDateString(LOCALE, { weekday: "long", month: "short", day: "numeric", timeZone: TIME_ZONE });
}

/** Whole days from now until the given ISO timestamp (negative if it's already past). Kept out of Server Components' own render bodies — Date.now() there trips the react-hooks/purity lint rule. */
export function daysFromNow(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
