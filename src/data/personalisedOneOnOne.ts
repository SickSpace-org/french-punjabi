/**
 * Static page copy and constants for the Personalised One-on-One batch.
 * Price, slots and availability all come from the database (see
 * supabase/067_personalised_one_on_one.sql): a slot is a one-seat batch under
 * a real phase, flagged is_one_on_one, and the price is a program offer.
 */

export const PERSONALISED_OFFER_KEY = "personalised_one_on_one" as const;
export const PERSONALISED_HREF = "/courses/personalised-one-on-one";
export const PERSONALISED_TITLE = "Personalised One-on-One";

/** Who new slots are assigned to by default. Matched against the teachers table by email, then by first name. */
export const DEFAULT_TEACHER_EMAIL = "hiteshsharma2454@gmail.com";
export const DEFAULT_TEACHER_NAME = "Hitesh";

export const PERSONALISED_GOOD_FOR = [
  { title: "Your own pace", body: "A private batch with only you in it. Every class is planned around your level, your goal and the exam you're sitting." },
  { title: "Fixed weekly time", body: "Your time slot is yours alone, so it never clashes with anyone else's." },
  { title: "Full student portal", body: "Lessons, recordings, quizzes, attendance and feedback, for as long as your batch runs." },
];

export const PERSONALISED_STEPS = [
  { title: "Pick your phase and slot", body: "Choose a free time under the phase you're in. It's held for you the moment you submit the form." },
  { title: "Send the e-Transfer", body: "Pay the first month by Interac e-Transfer. We confirm it by hand." },
  { title: "Start learning", body: "Once your payment is confirmed you get your student portal login and your first class." },
];

/** Anchor on each phase page where the one-on-one section lives. */
export const ONE_ON_ONE_ANCHOR = "one-on-one";
