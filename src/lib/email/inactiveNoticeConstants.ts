/**
 * Everything the "Email inactive students" message says, in ONE place. To change the wording, the contact link or the
 * footer, edit a single line below. Nothing else in the app contains this text.
 *
 * The send is REFUSED (see findNoticeConfigProblems in ./inactiveNotice.ts) while any value here still looks like a
 * placeholder (empty, "[something]", "PLACEHOLDER", "TODO"...), so a half-edited file can never reach a student.
 */
export const INACTIVE_NOTICE = {
  /** The only sender used for this message. Must be on the domain verified in Resend. */
  from: "AngrishFrançais <noreply@angrishfrancais.com>",

  /** Same subject for everyone (no personal data in it). */
  subject: "Your AngrishFrançais student account",

  /** First line when the student's first name is known: "Hi Priya,". When it is not: "Hi there,". */
  greetingWithName: "Hi",
  greetingWithoutName: "Hi there",

  /** Paragraph 1. */
  intro: "We're writing because your AngrishFrançais student account is currently inactive.",

  /**
   * Paragraph 2 is exactly: `${contactIntro} ${contactUrl}`, with the URL as a clickable link:
   * "If you'd like to rejoin, or you think this is a mistake, please contact us: https://www.angrishfrancais.com/contact"
   */
  contactIntro: "If you'd like to rejoin, or you think this is a mistake, please contact us:",
  contactUrl: "https://www.angrishfrancais.com/contact",

  signOff: "Thank you,",
  signOffName: "The AngrishFrançais team",

  /** Small print at the bottom of every email. */
  footer: "AngrishFrançais · Angrish Language classes Inc · 63 Binder Twine Trail, Brampton, ON L6X 4T2, Canada",
} as const;

/** A student who was emailed successfully within this many days is skipped. */
export const NOTICE_REPEAT_DAYS = 30;

/** Emails per Resend batch request (Resend allows up to 100; small chunks keep each request quick and a stop cheap). */
export const NOTICE_CHUNK_SIZE = 25;

/** A send that was stopped and never resumed is treated as abandoned after this many hours. */
export const NOTICE_STALE_PENDING_HOURS = 48;

/** Outside the real production deployment, only these addresses can ever receive this email (development safety net). */
export const NOTICE_DEV_ALLOWED_EMAIL = /^abhinavgarg4982(\+[^@\s]*)?@gmail\.com$/i;
