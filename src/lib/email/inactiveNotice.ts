/**
 * Pure helpers for the "Email N students" message on the admin Inactive Students page: the template, the
 * refuse-to-send checks, who gets it, and how Resend's answers are read. No I/O, no framework imports, so it can be unit-tested
 * with `npm run test:inactive-notice` and imported from both server code and tests.
 */
import { INACTIVE_NOTICE, NOTICE_DEV_ALLOWED_EMAIL } from "./inactiveNoticeConstants.ts";

export type NoticeConfig = { [K in keyof typeof INACTIVE_NOTICE]: string };

export type RenderedNotice = { subject: string; text: string; html: string };

// ---------------------------------------------------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Control characters and bidirectional-override characters have no business in a name or a header. */
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

/**
 * The first word of the full name, or null when there is nothing usable (empty, only punctuation).
 * Capped at 40 characters so a pasted paragraph in the name field cannot become a paragraph in the email.
 */
export function firstNameOf(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const cleaned = fullName.replace(UNSAFE_CHARS, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const first = cleaned.split(" ")[0];
  if (!/[\p{L}\p{N}]/u.test(first)) return null;
  return Array.from(first).slice(0, 40).join("");
}

/** "Hi Priya," when the first name is known, otherwise "Hi there,". */
export function greetingFor(fullName: string | null | undefined, config: NoticeConfig = INACTIVE_NOTICE): string {
  const first = firstNameOf(fullName);
  return first ? `${config.greetingWithName} ${first},` : `${config.greetingWithoutName},`;
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** One fixed message. Everything that goes into the HTML is escaped, the constants included. */
export function renderInactiveNotice(
  fullName: string | null | undefined,
  config: NoticeConfig = INACTIVE_NOTICE
): RenderedNotice {
  if (!isHttpsUrl(config.contactUrl)) {
    // The send guard reports this to the admin first; this is the last line of defence against a javascript: or relative link.
    throw new Error("Contact URL must be a full https:// link.");
  }

  const greeting = greetingFor(fullName, config);
  const subject = config.subject.replace(/[\r\n]+/g, " ").trim();
  const contactLine = `${config.contactIntro} ${config.contactUrl}`;

  const text = [
    greeting,
    "",
    config.intro,
    "",
    contactLine,
    "",
    config.signOff,
    config.signOffName,
    "",
    "--",
    config.footer,
    "",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111111;">
    <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;">${escapeHtml(config.intro)}</p>
    <p style="margin:0 0 16px;">${escapeHtml(config.contactIntro)} <a href="${escapeHtml(config.contactUrl)}">${escapeHtml(config.contactUrl)}</a></p>
    <p style="margin:0 0 24px;">${escapeHtml(config.signOff)}<br />${escapeHtml(config.signOffName)}</p>
    <hr style="border:0;border-top:1px solid #dddddd;margin:0 0 12px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:#666666;">${escapeHtml(config.footer)}</p>
  </body>
</html>`;

  return { subject, text, html };
}

// ---------------------------------------------------------------------------------------------------------------------
// Refuse-to-send checks
// ---------------------------------------------------------------------------------------------------------------------

export type NoticeProblem = { code: string; message: string };

const CONSTANTS_FILE = "src/lib/email/inactiveNoticeConstants.ts";

/** Empty, "[Something]", "PLACEHOLDER", "TODO", "{{x}}", "yourdomain"... anything that still needs a human to fill it in. */
export function isPlaceholderText(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return true;
  return /\[[^\]]*\]|\{\{.*\}\}|\bplaceholder\b|\btodo\b|\btbd\b|\bxxx+\b|yourdomain|example\.(com|org|net)\b|lorem ipsum/i.test(value);
}

export function isSandboxSender(from: string | null | undefined): boolean {
  if (!from) return true;
  return /@resend\.dev\b/i.test(from);
}

/** "Name <a@b.c>" -> "a@b.c"; a bare address is returned as is. */
export function emailAddressOf(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

/**
 * Everything that must be true before ANY real email (including the preview to yourself) is sent. Each problem says which
 * thing is wrong and where to fix it, so the admin (or you) can tell at a glance.
 */
export function findNoticeConfigProblems(input: {
  config?: NoticeConfig;
  apiKeyPresent: boolean;
  /** What the rest of the app would send from (getFromAddress()): the sandbox sender when RESEND_FROM_EMAIL is unset. */
  appFromAddress: string | null | undefined;
}): NoticeProblem[] {
  const config = input.config ?? INACTIVE_NOTICE;
  const problems: NoticeProblem[] = [];

  if (!input.apiKeyPresent) {
    problems.push({ code: "api_key_missing", message: "RESEND_API_KEY is not set on this server, so no email can be sent." });
  }

  if (isSandboxSender(input.appFromAddress)) {
    problems.push({
      code: "from_sandbox",
      message:
        "RESEND_FROM_EMAIL is not set (or is Resend's sandbox sender, onboarding@resend.dev). The sandbox can only deliver to the Resend account owner, never to students. Set RESEND_FROM_EMAIL to an address on your verified domain.",
    });
  }

  const sender = emailAddressOf(config.from);
  if (isPlaceholderText(config.from) || isSandboxSender(config.from) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender)) {
    problems.push({
      code: "from_invalid",
      message: `The sender in ${CONSTANTS_FILE} ("from") is a placeholder, the Resend sandbox sender, or not a valid address.`,
    });
  }

  const fields: [keyof NoticeConfig, string][] = [
    ["subject", "subject"],
    ["intro", "opening paragraph (intro)"],
    ["contactIntro", "contact line (contactIntro)"],
    ["signOff", "sign-off"],
    ["signOffName", "sign-off name"],
    ["footer", "footer (business name and address)"],
    ["greetingWithName", "greeting"],
    ["greetingWithoutName", "greeting fallback"],
  ];
  for (const [key, label] of fields) {
    if (isPlaceholderText(config[key])) {
      problems.push({
        code: `placeholder_${key}`,
        message: `The ${label} still contains a placeholder or is empty. Edit "${key}" in ${CONSTANTS_FILE}.`,
      });
    }
  }

  if (isPlaceholderText(config.contactUrl) || !isHttpsUrl(config.contactUrl)) {
    problems.push({
      code: "contact_url_invalid",
      message: `The contact link is a placeholder or not a full https:// address. Edit "contactUrl" in ${CONSTANTS_FILE}.`,
    });
  }

  return problems;
}

// ---------------------------------------------------------------------------------------------------------------------
// Who gets it
// ---------------------------------------------------------------------------------------------------------------------

export type NoticeStudent = { id: string; full_name: string | null; email: string | null };
export type NoticeRecipient = { studentId: string; email: string; fullName: string | null };

export type SkippedCounts = {
  noEmail: number;
  invalidEmail: number;
  duplicate: number;
  recentlyEmailed: number;
};

/** Trimmed, lower-cased address, or null when it is missing or cannot be a single plain address (also blocks header injection). */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (/[\s<>(),;:"\\\u0000-\u001f]/.test(email)) return null;
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return null;
  return email;
}

/**
 * Who gets the email: missing or invalid addresses are skipped, one address gets one email even if two student rows share it,
 * and anyone emailed within the last 30 days (recentlyEmailedIds) is skipped. Input order is kept.
 */
export function selectRecipients(
  students: NoticeStudent[],
  recentlyEmailedIds: ReadonlySet<string>
): { recipients: NoticeRecipient[]; skipped: SkippedCounts } {
  const skipped: SkippedCounts = { noEmail: 0, invalidEmail: 0, duplicate: 0, recentlyEmailed: 0 };
  const seen = new Set<string>();
  const recipients: NoticeRecipient[] = [];

  for (const student of students) {
    if (!student.email || !student.email.trim()) {
      skipped.noEmail += 1;
      continue;
    }
    const email = normalizeEmail(student.email);
    if (!email) {
      skipped.invalidEmail += 1;
      continue;
    }
    if (recentlyEmailedIds.has(student.id)) {
      skipped.recentlyEmailed += 1;
      continue;
    }
    if (seen.has(email)) {
      skipped.duplicate += 1;
      continue;
    }
    seen.add(email);
    recipients.push({ studentId: student.id, email, fullName: student.full_name });
  }

  return { recipients, skipped };
}

/**
 * Development safety net: outside the real production deployment (VERCEL_ENV !== "production": a laptop, or a preview build)
 * only the developer's own test addresses can receive this email, even if the database in use holds real students.
 */
export function isRecipientAllowedHere(email: string, vercelEnv: string | undefined): boolean {
  if (vercelEnv === "production") return true;
  return NOTICE_DEV_ALLOWED_EMAIL.test(email);
}

// ---------------------------------------------------------------------------------------------------------------------
// Reading Resend's answers
// ---------------------------------------------------------------------------------------------------------------------

export type ResendLikeError = { name?: string | null; message?: string | null; statusCode?: number | null };

/**
 * "quota" = daily/monthly sending limit reached, "rate_limit" = too many requests per second. Both mean: stop now, leave the
 * rest pending, try again later. Anything else is "other" (also stops, but is shown as an error).
 */
export function classifyResendError(error: ResendLikeError | null | undefined): "quota" | "rate_limit" | "other" {
  if (!error) return "other";
  const name = (error.name ?? "").toLowerCase();
  if (name.includes("quota")) return "quota";
  if (name === "rate_limit_exceeded" || error.statusCode === 429) {
    return /quota|daily|monthly/i.test(error.message ?? "") ? "quota" : "rate_limit";
  }
  return "other";
}

export type BatchItemResult = { index: number; ok: true; id: string } | { index: number; ok: false; error: string };

/**
 * Resend's "permissive" batch answer lists the created ids in order (failed items are left out) plus an `errors` list
 * with the original index of each failed item. This puts them back together, one result per email that was sent in.
 */
export function mapBatchResponse(
  count: number,
  data: { id: string }[] | null | undefined,
  errors: { index: number; message: string }[] | null | undefined
): BatchItemResult[] {
  const errorByIndex = new Map<number, string>((errors ?? []).map((e) => [e.index, e.message]));
  const ids = data ?? [];
  const results: BatchItemResult[] = [];
  let next = 0;
  for (let index = 0; index < count; index += 1) {
    const message = errorByIndex.get(index);
    if (message !== undefined) {
      results.push({ index, ok: false, error: message || "Rejected by Resend." });
    } else if (next < ids.length) {
      results.push({ index, ok: true, id: ids[next].id });
      next += 1;
    } else {
      results.push({ index, ok: false, error: "No result returned by Resend for this email." });
    }
  }
  return results;
}

/** True when a Supabase/PostgREST error means "the table does not exist yet" (migration 062 not applied). */
export function isMissingTableError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /could not find the table|relation .* does not exist/i.test(error.message ?? "");
}
