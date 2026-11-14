/**
 * Routes and static copy for the program offers that sit alongside the
 * phases on /courses. Prices, labels and durations come from the
 * `program_offers` table in Supabase; everything here is page copy.
 */

export const OFFER_HREF = {
  complete_program: "/courses/complete-program",
  redo_month: "/courses/repeat-a-month",
} as const;

/** The seven program months and the phase each one belongs to. */
export const PROGRAM_MONTHS = [
  { month: 1, phase: 1 },
  { month: 2, phase: 1 },
  { month: 3, phase: 1 },
  { month: 4, phase: 2 },
  { month: 5, phase: 2 },
  { month: 6, phase: 3 },
  { month: 7, phase: 3 },
] as const;

export const REPEAT_MONTH_REASONS = [
  { title: "You missed classes", body: "Travel, work or illness took you out for part of a month and you'd rather not move on with gaps." },
  { title: "Your monthly evaluation was low", body: "The feedback showed a skill that needs another pass before the next month builds on it." },
  { title: "You want more time before the exam", body: "Another round of practice before exam day, at the same pace as the class." },
];

export const REPEAT_MONTH_STEPS = [
  { title: "Tell us which month", body: "Enroll below and mention the month you want to repeat." },
  { title: "We confirm your timing", body: "We'll place you in a batch running that month and confirm the time with you." },
  { title: "Take the month again", body: "Same classes, weekly checks and monthly evaluation as the first time through." },
];
