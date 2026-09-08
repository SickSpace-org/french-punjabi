import { INTERAC_EMAIL } from "@/lib/enrollment/constants";

const NAVY = "#0b1c39";
const NAVY_DARK = "#071227";
const RED = "#c8102e";
const RED_DARK = "#9c0c24";
const CREAM = "#fbfaf7";
const CREAM_DIM = "#f3f1ea";

function formatAmount(amountDue: number, currency: string) {
  return `C$${amountDue.toFixed(2)} ${currency}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(bodyHtml: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AngrishFrançais</title>
  </head>
  <body style="margin:0;padding:0;background:${CREAM_DIM};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM_DIM};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(11,28,57,0.08);">
            <tr>
              <td style="height:6px;background:linear-gradient(90deg,${RED_DARK},${RED},${RED_DARK});font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;">
                <p style="margin:0;font-size:20px;font-weight:700;color:${NAVY};">
                  Angrish<span style="color:${RED};">Français</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;color:${NAVY};font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:${CREAM};border-top:1px solid rgba(11,28,57,0.08);color:rgba(11,28,57,0.5);font-size:12px;">
                AngrishFrançais Team
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export type EnrollmentEmailInfo = {
  fullName: string;
  phaseName: string;
  levelName: string | null;
  batchTiming: string;
};

export type PaymentEmailInfo = EnrollmentEmailInfo & {
  enrollmentRef: string;
  amountDue: number;
  currency: string;
};

export function enrollmentConfirmationSubject() {
  return "Enrollment Request Received — AngrishFrançais";
}

export function enrollmentConfirmationHtml(info: PaymentEmailInfo) {
  const name = escapeHtml(info.fullName);
  const phase = escapeHtml(info.phaseName);
  const level = info.levelName ? escapeHtml(info.levelName) : null;
  const timing = escapeHtml(info.batchTiming);
  const ref = escapeHtml(info.enrollmentRef);
  const amount = escapeHtml(formatAmount(info.amountDue, info.currency));
  const interacEmail = escapeHtml(INTERAC_EMAIL);

  return shell(`
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">Thank you for your interest in AngrishFrançais.</p>
    <p style="margin:0 0 12px;">We have received your enrollment request.</p>
    <p style="margin:0 0 8px;font-weight:700;color:${NAVY};">Your selection:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-left:4px solid ${RED};background:${CREAM_DIM};border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;font-weight:700;color:${NAVY};">${phase}</p>
          ${level ? `<p style="margin:2px 0 0;color:${NAVY};">${level}</p>` : ""}
          <p style="margin:2px 0 0;color:rgba(11,28,57,0.65);">${timing}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;">
      Enrollment Reference:<br /><strong style="color:${RED_DARK};">${ref}</strong>
    </p>
    <p style="margin:0 0 8px;">
      To complete your enrollment, please send the course fee via Interac
      e-Transfer to:
    </p>
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY};">${interacEmail}</p>
    <p style="margin:0 0 16px;">
      Amount:<br /><strong style="color:${RED_DARK};">${amount}</strong>
    </p>
    <p style="margin:0 0 16px;">
      Please include your Enrollment Reference in the transfer message/note
      where possible.
    </p>
    <p style="margin:0 0 16px;">
      Your seat will be confirmed after our team receives and verifies your
      payment.
    </p>
    <p style="margin:24px 0 0;">Regards,<br />AngrishFrançais Team</p>
  `);
}

export function enrollmentConfirmationText(info: PaymentEmailInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "Thank you for your interest in AngrishFrançais.",
    "",
    "We have received your enrollment request.",
    "",
    "Your selection:",
    info.phaseName,
    ...(info.levelName ? [info.levelName] : []),
    info.batchTiming,
    "",
    "Enrollment Reference:",
    info.enrollmentRef,
    "",
    "To complete your enrollment, please send the course fee via Interac e-Transfer to:",
    INTERAC_EMAIL,
    "",
    "Amount:",
    formatAmount(info.amountDue, info.currency),
    "",
    "Please include your Enrollment Reference in the transfer message/note where possible.",
    "",
    "Your seat will be confirmed after our team receives and verifies your payment.",
    "",
    "Regards,",
    "AngrishFrançais Team",
  ].join("\n");
}

export function paymentConfirmedSubject() {
  return "Enrollment Confirmed — AngrishFrançais";
}

export function paymentConfirmedHtml(info: PaymentEmailInfo) {
  const name = escapeHtml(info.fullName);
  const phase = escapeHtml(info.phaseName);
  const level = info.levelName ? escapeHtml(info.levelName) : null;
  const timing = escapeHtml(info.batchTiming);
  const ref = escapeHtml(info.enrollmentRef);
  const amount = escapeHtml(formatAmount(info.amountDue, info.currency));

  return shell(`
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">
      Your payment has been received and your enrollment with AngrishFrançais
      is now confirmed.
    </p>
    <p style="margin:0 0 8px;font-weight:700;color:${NAVY};">Course Details</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-left:4px solid ${RED};background:${CREAM_DIM};border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;font-weight:700;color:${NAVY};">${phase}</p>
          ${level ? `<p style="margin:2px 0 0;color:${NAVY};">${level}</p>` : ""}
          <p style="margin:2px 0 0;color:rgba(11,28,57,0.65);">${timing}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;">
      Amount Received:<br /><strong style="color:${RED_DARK};">${amount}</strong>
    </p>
    <p style="margin:0 0 16px;">
      Enrollment Reference:<br /><strong style="color:${RED_DARK};">${ref}</strong>
    </p>
    <p style="margin:0 0 16px;">
      Our team will contact you shortly with the next steps and class
      details.
    </p>
    <p style="margin:24px 0 0;">Thank you,<br />AngrishFrançais Team</p>
  `);
}

export function paymentConfirmedText(info: PaymentEmailInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "Your payment has been received and your enrollment with AngrishFrançais is now confirmed.",
    "",
    "COURSE DETAILS",
    info.phaseName,
    ...(info.levelName ? [info.levelName] : []),
    info.batchTiming,
    "",
    "Amount Received:",
    formatAmount(info.amountDue, info.currency),
    "",
    "Enrollment Reference:",
    info.enrollmentRef,
    "",
    "Our team will contact you shortly with the next steps and class details.",
    "",
    "Thank you,",
    "AngrishFrançais Team",
  ].join("\n");
}

export function paymentReminderSubject() {
  return "Reminder: Complete Your Payment — AngrishFrançais";
}

export function paymentReminderHtml(info: PaymentEmailInfo) {
  const name = escapeHtml(info.fullName);
  const phase = escapeHtml(info.phaseName);
  const level = info.levelName ? escapeHtml(info.levelName) : null;
  const timing = escapeHtml(info.batchTiming);
  const ref = escapeHtml(info.enrollmentRef);
  const amount = escapeHtml(formatAmount(info.amountDue, info.currency));
  const interacEmail = escapeHtml(INTERAC_EMAIL);

  return shell(`
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">
      This is a friendly reminder that we haven&rsquo;t yet received your payment to
      complete your enrollment with AngrishFrançais.
    </p>
    <p style="margin:0 0 8px;font-weight:700;color:${NAVY};">Your selection:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-left:4px solid ${RED};background:${CREAM_DIM};border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;font-weight:700;color:${NAVY};">${phase}</p>
          ${level ? `<p style="margin:2px 0 0;color:${NAVY};">${level}</p>` : ""}
          <p style="margin:2px 0 0;color:rgba(11,28,57,0.65);">${timing}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;">
      Enrollment Reference:<br /><strong style="color:${RED_DARK};">${ref}</strong>
    </p>
    <p style="margin:0 0 8px;">
      To complete your enrollment, please send the course fee via Interac
      e-Transfer to:
    </p>
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY};">${interacEmail}</p>
    <p style="margin:0 0 16px;">
      Amount Due:<br /><strong style="color:${RED_DARK};">${amount}</strong>
    </p>
    <p style="margin:0 0 16px;">
      Please include your Enrollment Reference in the transfer message/note
      where possible. Your seat will be confirmed as soon as our team
      receives and verifies your payment.
    </p>
    <p style="margin:0 0 16px;">
      If you&rsquo;ve already sent the payment, please disregard this reminder —
      it may cross with our confirmation.
    </p>
    <p style="margin:24px 0 0;">Regards,<br />AngrishFrançais Team</p>
  `);
}

export function paymentReminderText(info: PaymentEmailInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "This is a friendly reminder that we haven't yet received your payment to complete your enrollment with AngrishFrançais.",
    "",
    "Your selection:",
    info.phaseName,
    ...(info.levelName ? [info.levelName] : []),
    info.batchTiming,
    "",
    "Enrollment Reference:",
    info.enrollmentRef,
    "",
    "To complete your enrollment, please send the course fee via Interac e-Transfer to:",
    INTERAC_EMAIL,
    "",
    "Amount Due:",
    formatAmount(info.amountDue, info.currency),
    "",
    "Please include your Enrollment Reference in the transfer message/note where possible. Your seat will be confirmed as soon as our team receives and verifies your payment.",
    "",
    "If you've already sent the payment, please disregard this reminder — it may cross with our confirmation.",
    "",
    "Regards,",
    "AngrishFrançais Team",
  ].join("\n");
}

export type FeeReminderInfo = {
  fullName: string;
  /** "YYYY-MM-DD", or null if the admin hasn't set a due date for this student. */
  dueDate: string | null;
};

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const parsed = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function feeReminderSubject() {
  return "Payment Reminder — AngrishFrançais";
}

/**
 * Admin-triggered, on demand, from the Students tab (see sendFeeReminder in
 * students/[studentId]/actions.ts) — a general "your fees are due" nudge
 * for an already-enrolled student, separate from the one-time Interac
 * confirmation reminder sent to a still-PENDING enrollment
 * (paymentReminderHtml above). No amount is quoted here since a student can
 * span several courses/payment plans; the due date is the only thing an
 * admin sets per student.
 */
export function feeReminderHtml(info: FeeReminderInfo) {
  const name = escapeHtml(info.fullName);
  const dueDateLabel = formatDueDate(info.dueDate);
  const interacEmail = escapeHtml(INTERAC_EMAIL);

  return shell(`
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">
      This is a friendly reminder that your course fee payment is
      ${dueDateLabel ? `due by <strong style="color:${RED_DARK};">${escapeHtml(dueDateLabel)}</strong>` : "due"}.
    </p>
    <p style="margin:0 0 8px;">
      Please send your payment via Interac e-Transfer to:
    </p>
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY};">${interacEmail}</p>
    <p style="margin:0 0 16px;">
      Please include your name and enrollment reference in the transfer
      message/note where possible so we can match it quickly.
    </p>
    <p style="margin:0 0 16px;">
      If you&rsquo;ve already sent this payment, please disregard this
      reminder — it may cross with our confirmation.
    </p>
    <p style="margin:24px 0 0;">Regards,<br />AngrishFrançais Team</p>
  `);
}

export function feeReminderText(info: FeeReminderInfo) {
  const dueDateLabel = formatDueDate(info.dueDate);
  return [
    `Hello ${info.fullName},`,
    "",
    `This is a friendly reminder that your course fee payment is ${dueDateLabel ? `due by ${dueDateLabel}` : "due"}.`,
    "",
    "Please send your payment via Interac e-Transfer to:",
    INTERAC_EMAIL,
    "",
    "Please include your name and enrollment reference in the transfer message/note where possible so we can match it quickly.",
    "",
    "If you've already sent this payment, please disregard this reminder — it may cross with our confirmation.",
    "",
    "Regards,",
    "AngrishFrançais Team",
  ].join("\n");
}

export type AdminNotificationInfo = EnrollmentEmailInfo & {
  email: string;
  phone: string;
  enrollmentRef: string;
  amountDue: number;
  currency: string;
};

export function adminNotificationSubject() {
  return "NEW ENROLLMENT — AngrishFrançais";
}

export function adminNotificationHtml(info: AdminNotificationInfo) {
  const name = escapeHtml(info.fullName);
  const phase = escapeHtml(info.phaseName);
  const level = info.levelName ? escapeHtml(info.levelName) : null;
  const timing = escapeHtml(info.batchTiming);
  const email = escapeHtml(info.email);
  const phone = escapeHtml(info.phone);
  const ref = escapeHtml(info.enrollmentRef);
  const amount = escapeHtml(formatAmount(info.amountDue, info.currency));

  return shell(`
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY_DARK};">New enrollment request received.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);width:110px;">Student</td><td style="padding:6px 0;font-weight:600;">${name}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Course</td><td style="padding:6px 0;">${phase}${level ? ` — ${level}` : ""}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Batch</td><td style="padding:6px 0;">${timing}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Phone</td><td style="padding:6px 0;">${phone}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Email</td><td style="padding:6px 0;">${email}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Amount Due</td><td style="padding:6px 0;">${amount}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Reference</td><td style="padding:6px 0;font-weight:600;">${ref}</td></tr>
    </table>
  `);
}

export type StudentLoginCredentialsInfo = {
  fullName: string;
  /** 6-digit one-time sign-in code (Supabase's raw email_otp — deliberately
   * NOT a clickable link, see studentLoginCredentialsHtml below). */
  code: string;
  password: string;
};

export function studentLoginCredentialsSubject() {
  return "Your Student Portal Access — AngrishFrançais";
}

/**
 * Deliberately sends a code to type in, not a clickable "magic link" URL.
 * A clickable one-time link in an email gets silently pre-visited (and so
 * burned) by corporate mail security scanners (Microsoft Safe Links,
 * Mimecast, Proofpoint, etc.) before the student ever opens the email,
 * which is what made the old link-based email "expire" within seconds for
 * some students. A code has nothing for a scanner to click.
 */
export function studentLoginCredentialsHtml(info: StudentLoginCredentialsInfo) {
  const name = escapeHtml(info.fullName);
  const code = escapeHtml(info.code);
  const password = escapeHtml(info.password);

  return shell(`
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">Here&rsquo;s access to your AngrishFrançais Student Portal.</p>
    <p style="margin:0 0 8px;">
      Go to the Student Login page, choose &ldquo;Have a sign-in code instead?&rdquo;, enter your
      email, and type in this code:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-left:4px solid ${RED};background:${CREAM_DIM};border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;color:rgba(11,28,57,0.5);font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Sign-In Code</p>
          <p style="margin:2px 0 0;font-weight:700;color:${NAVY};font-size:22px;letter-spacing:0.08em;">${code}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;">
      Or, if you&rsquo;d rather use a permanent password, choose &ldquo;Have a password instead?&rdquo;
      on that same page:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-left:4px solid ${RED};background:${CREAM_DIM};border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;color:rgba(11,28,57,0.5);font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Password</p>
          <p style="margin:2px 0 0;font-weight:700;color:${NAVY};font-size:16px;">${password}</p>
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;">Regards,<br />AngrishFrançais Team</p>
  `);
}

export type StudentPortalAccessInfo = {
  fullName: string;
  /** Permanent, bookmarkable link to /student/access/{token} — no
   * password, no code, no separate verify step. See
   * supabase/013_student_portal_access_link.sql. */
  accessLink: string;
};

export function studentPortalAccessSubject() {
  return "You're In! Access Your Student Portal — AngrishFrançais";
}

export function studentPortalAccessHtml(info: StudentPortalAccessInfo) {
  const name = escapeHtml(info.fullName);

  return shell(`
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">
      Your payment is confirmed — you&rsquo;re in! Use the button below any time to open your
      AngrishFrançais Student Portal.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;">
      <tr>
        <td style="padding:16px 0;text-align:center;">
          <a href="${info.accessLink}" style="display:inline-block;background:${RED};color:#ffffff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">
            Open Student Portal
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;">
      No password, no code — bookmark this link and use it any time you want to get back in.
    </p>
    <p style="margin:0 0 16px;color:rgba(11,28,57,0.6);font-size:13px;">
      Treat this link like a password: anyone who has it can open your portal. Don&rsquo;t forward
      or share it. If you ever think someone else has seen it, contact us and we&rsquo;ll issue you
      a fresh one.
    </p>
    <p style="margin:24px 0 0;">Regards,<br />AngrishFrançais Team</p>
  `);
}

export function studentPortalAccessText(info: StudentPortalAccessInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "Your payment is confirmed — you're in! Use this link any time to open your AngrishFrançais Student Portal:",
    info.accessLink,
    "",
    "No password, no code needed — bookmark this link.",
    "",
    "Treat this link like a password: anyone who has it can open your portal. Don't forward or share it. If you ever think someone else has seen it, contact us and we'll issue you a fresh one.",
    "",
    "Regards,",
    "AngrishFrançais Team",
  ].join("\n");
}

export function studentLoginCredentialsText(info: StudentLoginCredentialsInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "Here's access to your AngrishFrançais Student Portal.",
    "",
    "Go to the Student Login page, choose \"Have a sign-in code instead?\", enter your email, and type in this code:",
    `Sign-In Code: ${info.code}`,
    "",
    "Or, if you'd rather use a permanent password, choose \"Have a password instead?\" on that same page:",
    `Password: ${info.password}`,
    "",
    "Regards,",
    "AngrishFrançais Team",
  ].join("\n");
}
