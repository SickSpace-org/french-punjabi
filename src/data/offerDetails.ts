/**
 * Routes and static copy for the three program offers that sit alongside
 * the phases on /courses. Prices, labels and durations come from the
 * `program_offers` table in Supabase; everything here is page copy.
 */

export const OFFER_HREF = {
  complete_program: "/courses/complete-program",
  redo_month: "/courses/repeat-a-month",
  one_on_one_testing: "/courses/one-on-one",
} as const;

export const CALENDLY_URL =
  "https://calendly.com/hiteshsharma2454/french-appointment?month=2026-09";

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

export const COMPLETE_PROGRAM_INCLUDES = [
  { title: "All three phases", body: "Foundation, TEF/TCF Prep and Exam Mastery, in order, with no re-enrolling between them." },
  { title: "Classes at a fixed time", body: "Your batch timing is confirmed after you enroll and stays with you through the program." },
  { title: "Checks every week", body: "Short grammar, vocabulary and pronunciation quizzes plus mini speaking tasks." },
  { title: "An evaluation every month", body: "Writing, speaking, listening and reading, each marked with personal feedback." },
];

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

export const ONE_ON_ONE_GOOD_FOR = [
  { title: "Checking your level", body: "Not sure whether to start at Foundation or jump ahead? A teacher can tell you where you stand." },
  { title: "Getting ready for the exam", body: "Practise TEF/TCF tasks and get corrected before you pay for the real thing." },
  { title: "Working on a weak spot", body: "Spend the hour on the skill that's holding you back, at your own pace." },
];

export const ONE_ON_ONE_STEPS = [
  { title: "Pick a time", body: "Choose a slot that suits you on our booking calendar." },
  { title: "Meet your teacher", body: "Just you and a teacher, with no class around you." },
  { title: "Leave with feedback", body: "Where you stand now and what to focus on next." },
];

/**
 * Local price overrides applied on top of `program_offers` from Supabase,
 * both on the public pages and when an enrollment's amount is recorded.
 * Kept in code so localhost can differ without touching the shared DB.
 */
export const OFFER_PRICE_OVERRIDES: Partial<
  Record<"complete_program" | "redo_month" | "one_on_one_testing", { base: number; duration?: string }>
> = {
  one_on_one_testing: { base: 30, duration: "1 hr" },
};

/** Compact "per" label for a price: "1 hr" or "hour" → "/hr", "30 min" → "/30 min". */
export function perDuration(duration?: string) {
  if (!duration) return "";
  const d = duration.trim();
  if (/^(1\s*)?(hr|hour)s?$/i.test(d)) return "/hr";
  return `/${d}`;
}
