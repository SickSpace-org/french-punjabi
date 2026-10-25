/**
 * Pure date rules for the existing-student (non-Stripe, monthly) feature —
 * no I/O, no framework imports, so scripts/checkpoint3/test-existing-due-notice.mjs
 * can import and exercise this exact file.
 *
 * Everything works in whole UTC days: students.next_payment_due is a plain
 * `date` column (supabase/015), read as UTC midnight everywhere else in
 * this feature (dry-run script, cron digest, settle_existing_student_payment).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** An existing student may never be suspended/inactivated for a due date
 * earlier than (the day they were enabled + this many days) — a student
 * enabled after their due date had already passed gets a full week of
 * warning before any consequence can attach to it. */
export const ENFORCEMENT_GRACE_DAYS = 7;

/** The "your payment is due soon" notice goes out once the due date is this
 * many days away or closer (and not yet past). */
export const DUE_NOTICE_WINDOW_DAYS = 7;

/** Whole UTC-day number of a `YYYY-MM-DD` date string, or null if it is not one. */
export function dueDateDayNumber(due: string | null | undefined): number | null {
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return null;
  const t = Date.parse(`${due}T00:00:00Z`);
  return Number.isNaN(t) ? null : Math.floor(t / DAY_MS);
}

/** Whole days from `today` (UTC) until the due date; negative once overdue. Null if no valid due date. */
export function daysUntilDue(due: string | null | undefined, today: Date): number | null {
  const dueDay = dueDateDayNumber(due);
  if (dueDay === null) return null;
  return dueDay - Math.floor(today.getTime() / DAY_MS);
}

/** True while the due-soon notice should be sent: due today up to DUE_NOTICE_WINDOW_DAYS away. */
export function isInDueNoticeWindow(due: string | null | undefined, today: Date): boolean {
  const days = daysUntilDue(due, today);
  return days !== null && days >= 0 && days <= DUE_NOTICE_WINDOW_DAYS;
}

/**
 * The protective rule: may an automated suspension/inactivation attach to
 * THIS due date for THIS student?
 *
 * "Enabled date" is existing_lifecycle_announced_at — stamped the moment a
 * student first becomes eligible and is told (announceExistingStudentPaymentIfEligible),
 * which is the moment the feature actually reached them. Fails CLOSED: a
 * missing/invalid announced-at, or a missing/invalid due date, means "no".
 *
 * Allowed only when due >= enabledDay + ENFORCEMENT_GRACE_DAYS (a due date
 * exactly 7 days after enabling is allowed; anything earlier is not).
 */
export function enforcementAllowed(input: {
  nextPaymentDue: string | null | undefined;
  announcedAt: string | null | undefined;
}): boolean {
  const dueDay = dueDateDayNumber(input.nextPaymentDue);
  if (dueDay === null) return false;
  if (!input.announcedAt) return false;
  const announced = Date.parse(input.announcedAt);
  if (Number.isNaN(announced)) return false;
  const enabledDay = Math.floor(announced / DAY_MS);
  return dueDay >= enabledDay + ENFORCEMENT_GRACE_DAYS;
}

/** "October 22, 2026" — UTC, to match how the due date itself is interpreted. */
export function formatDueDateLabel(due: string): string {
  return new Date(`${due}T00:00:00Z`).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** ISO date (YYYY-MM-DD) of the UTC day `offsetDays` from `base`. */
export function utcDateString(base: Date, offsetDays = 0): string {
  return new Date(Math.floor(base.getTime() / DAY_MS) * DAY_MS + offsetDays * DAY_MS).toISOString().slice(0, 10);
}
