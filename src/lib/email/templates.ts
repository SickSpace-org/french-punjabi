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

export type TeacherPortalAccessInfo = {
  fullName: string;
  /** Permanent, bookmarkable link to /teacher/access/{token} — no
   * password, no code, no separate verify step. See
   * supabase/029_teachers.sql. */
  accessLink: string;
};

export function teacherPortalAccessSubject() {
  return "You're In! Access Your Teacher Portal — AngrishFrançais";
}

export function teacherPortalAccessHtml(info: TeacherPortalAccessInfo) {
  const name = escapeHtml(info.fullName);

  return shell(`
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">
      You&rsquo;ve been added as a teacher — use the button below any time to open your
      AngrishFrançais Teacher Portal.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;">
      <tr>
        <td style="padding:16px 0;text-align:center;">
          <a href="${info.accessLink}" style="display:inline-block;background:${RED};color:#ffffff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">
            Open Teacher Portal
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

export function teacherPortalAccessText(info: TeacherPortalAccessInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "You've been added as a teacher — use this link any time to open your AngrishFrançais Teacher Portal:",
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

export type NewTicketNotificationInfo = {
  studentName: string;
  subject: string;
  body: string;
};

export function newTicketNotificationSubject() {
  return "NEW SUPPORT TICKET — AngrishFrançais";
}

/** Sent to admin via sendNewTicketNotification (see send.ts) — mirrors adminNotificationHtml's shape/gating exactly, just for a different trigger (a new support ticket instead of a new enrollment). */
export function newTicketNotificationHtml(info: NewTicketNotificationInfo) {
  const name = escapeHtml(info.studentName);
  const subject = escapeHtml(info.subject);
  const body = escapeHtml(info.body).replace(/\n/g, "<br />");

  return shell(`
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY_DARK};">A student opened a new support ticket.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);width:110px;">Student</td><td style="padding:6px 0;font-weight:600;">${name}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Subject</td><td style="padding:6px 0;font-weight:600;">${subject}</td></tr>
    </table>
    <p style="margin:16px 0 0;padding:12px 14px;background:${CREAM_DIM};border-radius:10px;color:${NAVY};">${body}</p>
  `);
}

export type TicketReplyNotificationInfo = {
  fullName: string;
  subject: string;
  body: string;
};

export function ticketReplyNotificationSubject() {
  return "Reply to your support ticket — AngrishFrançais";
}

/** Sent to the student via sendTicketReplyNotification (see send.ts) when admin replies — the one asymmetric addition for this feature, since nothing else in the portal (messages, feedback notes) emails a student when new content arrives for them. */
export function ticketReplyNotificationHtml(info: TicketReplyNotificationInfo) {
  const subject = escapeHtml(info.subject);
  const body = escapeHtml(info.body).replace(/\n/g, "<br />");

  return shell(`
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY_DARK};">Hi ${escapeHtml(info.fullName)}, the AngrishFrançais team replied to your support ticket.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);width:110px;">Subject</td><td style="padding:6px 0;font-weight:600;">${subject}</td></tr>
    </table>
    <p style="margin:16px 0 0;padding:12px 14px;background:${CREAM_DIM};border-radius:10px;color:${NAVY};">${body}</p>
    <p style="margin:16px 0 0;color:rgba(11,28,57,0.6);">Sign in to the Student Portal to reply.</p>
  `);
}

export function ticketReplyNotificationText(info: TicketReplyNotificationInfo) {
  return [
    `Hi ${info.fullName},`,
    "",
    "The AngrishFrançais team replied to your support ticket:",
    `Subject: ${info.subject}`,
    "",
    info.body,
    "",
    "Sign in to the Student Portal to reply.",
    "",
    "Regards,",
    "AngrishFrançais Team",
  ].join("\n");
}

export type WaitlistEmailInfo = {
  fullName: string;
  courseName: string;
  batchTiming: string;
  /** Where the student can enroll once a seat is free. */
  enrollUrl: string;
};

export function waitlistJoinedSubject() {
  return "You're on the waitlist — AngrishFrançais";
}

export function waitlistJoinedHtml(info: WaitlistEmailInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">That batch is full right now, so we've put you on its waitlist:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:${CREAM};border-radius:10px;">
      <strong>${escapeHtml(info.courseName)}</strong><br />${escapeHtml(info.batchTiming)}
    </p>
    <p style="margin:0;">As soon as a seat opens we'll email you so you can enroll. There's nothing you need to do until then.</p>
  `);
}

export function waitlistJoinedText(info: WaitlistEmailInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

That batch is full right now, so we've put you on its waitlist:
${info.courseName}
${info.batchTiming}

As soon as a seat opens we'll email you so you can enroll. There's nothing you need to do until then.

AngrishFrançais Team`;
}

export function seatOpenSubject() {
  return "A seat just opened up — AngrishFrançais";
}

export function seatOpenHtml(info: WaitlistEmailInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  const url = escapeHtml(info.enrollUrl);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Good news: a seat is now free in the batch you were waiting for.</p>
    <p style="margin:0 0 20px;padding:12px 16px;background:${CREAM};border-radius:10px;">
      <strong>${escapeHtml(info.courseName)}</strong><br />${escapeHtml(info.batchTiming)}
    </p>
    <p style="margin:0 0 20px;">
      <a href="${url}" style="display:inline-block;padding:12px 22px;background:${RED};color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">Enroll now</a>
    </p>
    <p style="margin:0;color:rgba(11,28,57,0.6);font-size:13px;">Seats go to whoever enrolls first, and everyone on the waitlist got this email.</p>
  `);
}

export function seatOpenText(info: WaitlistEmailInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Good news: a seat is now free in the batch you were waiting for.
${info.courseName}
${info.batchTiming}

Enroll here: ${info.enrollUrl}

Seats go to whoever enrolls first, and everyone on the waitlist got this email.

AngrishFrançais Team`;
}

export type AdminWaitlistInfo = {
  fullName: string;
  email: string;
  phone: string;
  courseName: string;
  batchTiming: string;
  message: string | null;
};

export function adminWaitlistSubject() {
  return "NEW WAITLIST SIGN-UP — AngrishFrançais";
}

export function adminWaitlistHtml(info: AdminWaitlistInfo) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);width:110px;">${label}</td><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`;
  return shell(`
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY_DARK};">Someone wants a seat in a full batch.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${row("Student", info.fullName)}
      ${row("Course", info.courseName)}
      ${row("Batch", info.batchTiming)}
      ${row("Phone", info.phone)}
      ${row("Email", info.email)}
      ${info.message ? row("Message", info.message) : ""}
    </table>
    <p style="margin:16px 0 0;color:rgba(11,28,57,0.6);font-size:13px;">They'll be emailed automatically when you free a seat in this batch from Admin → Courses.</p>
  `);
}

export type SubscriptionWelcomeInfo = {
  fullName: string;
  courseName: string;
  batchTiming: string;
  amount: number;
  currency: string;
  /** All added for the public Enroll-page cutover (behind
   * NEXT_PUBLIC_STRIPE_ENROLL_ENABLED) — optional and rendered only when
   * present so the pre-existing test-page call site (which may not always
   * have all three) degrades gracefully rather than showing "undefined". */
  levelName?: string | null;
  classLink?: string | null;
  portalLink?: string;
};

export function subscriptionWelcomeSubject() {
  return "You're enrolled — AngrishFrançais";
}

export function subscriptionWelcomeHtml(info: SubscriptionWelcomeInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your payment went through and your seat is confirmed:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:${CREAM};border-radius:10px;">
      <strong>${escapeHtml(info.courseName)}</strong><br />${escapeHtml(info.batchTiming)}${info.levelName ? `<br />Level: ${escapeHtml(info.levelName)}` : ""}
    </p>
    <p style="margin:0 0 16px;">You were charged ${info.currency} $${info.amount.toFixed(2)} today, and the same amount will renew monthly until you cancel.</p>
    ${info.classLink ? `<p style="margin:0 0 16px;">Class link: <a href="${escapeHtml(info.classLink)}" style="color:${RED};">${escapeHtml(info.classLink)}</a></p>` : ""}
    ${info.portalLink ? `<p style="margin:0;"><a href="${escapeHtml(info.portalLink)}" style="display:inline-block;background:${RED};color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;">Sign In To Your Portal</a></p>` : ""}
  `);
}

export function subscriptionWelcomeText(info: SubscriptionWelcomeInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your payment went through and your seat is confirmed:
${info.courseName}
${info.batchTiming}${info.levelName ? `\nLevel: ${info.levelName}` : ""}

You were charged ${info.currency} $${info.amount.toFixed(2)} today, and the same amount will renew monthly until you cancel.
${info.classLink ? `\nClass link: ${info.classLink}` : ""}
${info.portalLink ? `\nSign in to your portal: ${info.portalLink}` : ""}

AngrishFrançais Team`;
}

export type FullPaymentWelcomeInfo = {
  fullName: string;
  courseName: string;
  batchTiming: string;
  amount: number;
  currency: string;
  levelName?: string | null;
  classLink?: string | null;
  portalLink?: string;
};

export function fullPaymentWelcomeSubject() {
  return "You're enrolled — AngrishFrançais";
}

export function fullPaymentWelcomeHtml(info: FullPaymentWelcomeInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your payment went through and your seat is confirmed:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:${CREAM};border-radius:10px;">
      <strong>${escapeHtml(info.courseName)}</strong><br />${escapeHtml(info.batchTiming)}${info.levelName ? `<br />Level: ${escapeHtml(info.levelName)}` : ""}
    </p>
    <p style="margin:0 0 16px;">You were charged ${info.currency} $${info.amount.toFixed(2)} in full — this is a one-time payment, nothing else will be charged for this program.</p>
    ${info.classLink ? `<p style="margin:0 0 16px;">Class link: <a href="${escapeHtml(info.classLink)}" style="color:${RED};">${escapeHtml(info.classLink)}</a></p>` : ""}
    ${info.portalLink ? `<p style="margin:0;"><a href="${escapeHtml(info.portalLink)}" style="display:inline-block;background:${RED};color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;">Sign In To Your Portal</a></p>` : ""}
  `);
}

export function fullPaymentWelcomeText(info: FullPaymentWelcomeInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your payment went through and your seat is confirmed:
${info.courseName}
${info.batchTiming}${info.levelName ? `\nLevel: ${info.levelName}` : ""}

You were charged ${info.currency} $${info.amount.toFixed(2)} in full — this is a one-time payment, nothing else will be charged for this program.
${info.classLink ? `\nClass link: ${info.classLink}` : ""}
${info.portalLink ? `\nSign in to your portal: ${info.portalLink}` : ""}

AngrishFrançais Team`;
}

export type SubscriptionLostRaceInfo = {
  fullName: string;
  courseName: string;
  batchTiming: string;
};

export function subscriptionLostRaceSubject() {
  return "That seat was just taken — you're on the waitlist — AngrishFrançais";
}

export function subscriptionLostRaceHtml(info: SubscriptionLostRaceInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Someone else's payment for the last seat in this batch completed moments before yours did:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:${CREAM};border-radius:10px;">
      <strong>${escapeHtml(info.courseName)}</strong><br />${escapeHtml(info.batchTiming)}
    </p>
    <p style="margin:0 0 16px;">You have NOT been charged — if a payment briefly appeared, it's already been cancelled/refunded in full. We've added you to this batch's waitlist and will email you the moment a seat frees up so you can try again.</p>
    <p style="margin:0;">Sorry for the inconvenience.</p>
  `);
}

export function subscriptionLostRaceText(info: SubscriptionLostRaceInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Someone else's payment for the last seat in this batch completed moments before yours did:
${info.courseName}
${info.batchTiming}

You have NOT been charged — if a payment briefly appeared, it's already been cancelled/refunded in full. We've added you to this batch's waitlist and will email you the moment a seat frees up so you can try again.

Sorry for the inconvenience.

AngrishFrançais Team`;
}

export type SubscriptionTrialStartedInfo = {
  fullName: string;
  courseName: string;
  batchTiming: string;
  amount: number;
  currency: string;
  firstChargeDate: string;
  /** See the matching note on SubscriptionWelcomeInfo above. */
  levelName?: string | null;
  classLink?: string | null;
  portalLink?: string;
};

export function subscriptionTrialStartedSubject() {
  return "Your 7-day free trial has started — AngrishFrançais";
}

export function subscriptionTrialStartedHtml(info: SubscriptionTrialStartedInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your 7-day free trial has started and your seat is confirmed — no charge today:</p>
    <p style="margin:0 0 16px;padding:12px 16px;background:${CREAM};border-radius:10px;">
      <strong>${escapeHtml(info.courseName)}</strong><br />${escapeHtml(info.batchTiming)}${info.levelName ? `<br />Level: ${escapeHtml(info.levelName)}` : ""}
    </p>
    <p style="margin:0 0 16px;">Your card is on file. On ${escapeHtml(info.firstChargeDate)} you'll be charged ${info.currency} $${info.amount.toFixed(2)}, then the same amount monthly until you cancel.</p>
    ${info.classLink ? `<p style="margin:0 0 16px;">Class link: <a href="${escapeHtml(info.classLink)}" style="color:${RED};">${escapeHtml(info.classLink)}</a></p>` : ""}
    ${info.portalLink ? `<p style="margin:0;"><a href="${escapeHtml(info.portalLink)}" style="display:inline-block;background:${RED};color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;">Sign In To Your Portal</a></p>` : ""}
  `);
}

export function subscriptionTrialStartedText(info: SubscriptionTrialStartedInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your 7-day free trial has started and your seat is confirmed — no charge today:
${info.courseName}
${info.batchTiming}${info.levelName ? `\nLevel: ${info.levelName}` : ""}

Your card is on file. On ${info.firstChargeDate} you'll be charged ${info.currency} $${info.amount.toFixed(2)}, then the same amount monthly until you cancel.
${info.classLink ? `\nClass link: ${info.classLink}` : ""}
${info.portalLink ? `\nSign in to your portal: ${info.portalLink}` : ""}

AngrishFrançais Team`;
}

export type SubscriptionPaymentSucceededInfo = {
  fullName: string;
  amount: number;
  currency: string;
  nextRenewalDate: string;
};

export function subscriptionPaymentSucceededSubject() {
  return "Payment received — AngrishFrançais";
}

export function subscriptionPaymentSucceededHtml(info: SubscriptionPaymentSucceededInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your payment of ${info.currency} $${info.amount.toFixed(2)} went through. Your access continues uninterrupted.</p>
    <p style="margin:0;">Next renewal: ${escapeHtml(info.nextRenewalDate)}.</p>
  `);
}

export function subscriptionPaymentSucceededText(info: SubscriptionPaymentSucceededInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your payment of ${info.currency} $${info.amount.toFixed(2)} went through. Your access continues uninterrupted.

Next renewal: ${info.nextRenewalDate}.

AngrishFrançais Team`;
}

export type SubscriptionCanceledInfo = {
  fullName: string;
  courseName: string;
};

export function subscriptionCanceledSubject() {
  return "Your subscription has been cancelled — AngrishFrançais";
}

export function subscriptionCanceledHtml(info: SubscriptionCanceledInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your subscription to <strong>${escapeHtml(info.courseName)}</strong> has been cancelled and your seat has been released.</p>
    <p style="margin:0;">You're welcome to sign up again any time — note a new signup won't be eligible for another free trial on the same email or card.</p>
  `);
}

export function subscriptionCanceledText(info: SubscriptionCanceledInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your subscription to ${info.courseName} has been cancelled and your seat has been released.

You're welcome to sign up again any time — note a new signup won't be eligible for another free trial on the same email or card.

AngrishFrançais Team`;
}

export type PhaseCompletedInfo = {
  fullName: string;
  courseName: string;
  portalLink?: string;
};

/** The day-90 cap (see src/lib/payments/phaseLength.ts) ending a
 * subscription on schedule — deliberately NOT the cancellation email
 * above. A student reading "cancelled" right after finishing a paid
 * phase on time reads as a penalty; this is the opposite of one. */
export function phaseCompletedSubject(info: PhaseCompletedInfo) {
  return `You've completed ${info.courseName} — AngrishFrançais`;
}

export function phaseCompletedHtml(info: PhaseCompletedInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">You've completed <strong>${escapeHtml(info.courseName)}</strong> — nothing more is owed on it, and your billing for it has ended on schedule.</p>
    <p style="margin:0 0 16px;">Ready to keep going? Sign in to your student portal and pick your next phase whenever you're ready.</p>
    ${info.portalLink ? `<p style="margin:0;"><a href="${escapeHtml(info.portalLink)}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Choose Your Next Phase</a></p>` : ""}
  `);
}

export function phaseCompletedText(info: PhaseCompletedInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

You've completed ${info.courseName} — nothing more is owed on it, and your billing for it has ended on schedule.

Ready to keep going? Sign in to your student portal and pick your next phase whenever you're ready.
${info.portalLink ? `\n${info.portalLink}\n` : ""}
AngrishFrançais Team`;
}

export type SubscriptionDuplicateTrialCardInfo = {
  fullName: string;
  courseName: string;
};

export function subscriptionDuplicateTrialCardSubject() {
  return "We couldn't start a new free trial — AngrishFrançais";
}

export function subscriptionDuplicateTrialCardHtml(info: SubscriptionDuplicateTrialCardInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">The payment method you used for <strong>${escapeHtml(info.courseName)}</strong> has already been used for a free trial on a different account. You have NOT been charged, and this signup was not started.</p>
    <p style="margin:0;">If you'd still like to join, you can sign up again with a different payment method — you just won't be eligible for another free trial period.</p>
  `);
}

export function subscriptionDuplicateTrialCardText(info: SubscriptionDuplicateTrialCardInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

The payment method you used for ${info.courseName} has already been used for a free trial on a different account. You have NOT been charged, and this signup was not started.

If you'd still like to join, you can sign up again with a different payment method — you just won't be eligible for another free trial period.

AngrishFrançais Team`;
}

export type PaymentOverdueReminderInfo = {
  fullName: string;
  amount: number;
  currency: string;
  daysOverdue: number;
};

export function paymentOverdueReminderSubject() {
  return "Payment reminder — AngrishFrançais";
}

export function paymentOverdueReminderHtml(info: PaymentOverdueReminderInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your payment of ${info.currency} $${info.amount.toFixed(2)} is now ${info.daysOverdue} day${info.daysOverdue === 1 ? "" : "s"} overdue. Your access is still fully active — nothing to worry about yet, but please update your payment method soon.</p>
    <p style="margin:0;">If payment isn't received within a few more days, your access will be temporarily paused.</p>
  `);
}

export function paymentOverdueReminderText(info: PaymentOverdueReminderInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your payment of ${info.currency} $${info.amount.toFixed(2)} is now ${info.daysOverdue} day${info.daysOverdue === 1 ? "" : "s"} overdue. Your access is still fully active — nothing to worry about yet, but please update your payment method soon.

If payment isn't received within a few more days, your access will be temporarily paused.

AngrishFrançais Team`;
}

export type AdminPaymentAlertInfo = {
  kind: "refund" | "dispute";
  studentEmail: string;
  studentName: string | null;
  amount: number;
  currency: string;
  stripeObjectId: string;
  /** e.g. "This refund also reversed a referral reward for this student's referrer." — see reverse_referral_if_refunded, migration 049. */
  note?: string;
};

export function adminPaymentAlertSubject(info: AdminPaymentAlertInfo) {
  return info.kind === "refund"
    ? `Refund processed — ${info.studentEmail}`
    : `Dispute opened — ${info.studentEmail} — ACTION NEEDED`;
}

export function adminPaymentAlertHtml(info: AdminPaymentAlertInfo) {
  const label = info.kind === "refund" ? "A charge was refunded" : "A chargeback/dispute was opened";
  return shell(`
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY_DARK};">${label}.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);width:110px;">Student</td><td style="padding:6px 0;">${escapeHtml(info.studentName ?? "")} &lt;${escapeHtml(info.studentEmail)}&gt;</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Amount</td><td style="padding:6px 0;">${info.currency} $${info.amount.toFixed(2)}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(11,28,57,0.5);">Stripe ID</td><td style="padding:6px 0;">${escapeHtml(info.stripeObjectId)}</td></tr>
    </table>
    <p style="margin:16px 0 0;color:rgba(11,28,57,0.6);font-size:13px;">Logged to payment_events — no access change was made automatically (refund policy is still pending). ${info.kind === "dispute" ? "Disputes need a response in the Stripe Dashboard before the deadline." : ""}</p>
    ${info.note ? `<p style="margin:10px 0 0;font-weight:600;color:${NAVY_DARK};font-size:13px;">${escapeHtml(info.note)}</p>` : ""}
  `);
}

export function adminPaymentAlertText(info: AdminPaymentAlertInfo) {
  const label = info.kind === "refund" ? "A charge was refunded" : "A chargeback/dispute was opened";
  return `${label}.

Student: ${info.studentName ?? ""} <${info.studentEmail}>
Amount: ${info.currency} $${info.amount.toFixed(2)}
Stripe ID: ${info.stripeObjectId}

Logged to payment_events — no access change was made automatically (refund policy is still pending). ${info.kind === "dispute" ? "Disputes need a response in the Stripe Dashboard before the deadline." : ""}${info.note ? `\n\n${info.note}` : ""}`;
}

export type ExistingStudentDigestInfo = {
  students: { fullName: string; email: string; daysOverdue: number }[];
};

export function existingStudentDigestSubject(info: ExistingStudentDigestInfo) {
  return `${info.students.length} existing student${info.students.length === 1 ? " is" : "s are"} past due — AngrishFrançais`;
}

export function existingStudentDigestHtml(info: ExistingStudentDigestInfo) {
  const rows = info.students
    .map(
      (s) =>
        `<tr><td style="padding:6px 0;border-top:1px solid rgba(11,28,57,0.08);">${escapeHtml(s.fullName)}</td><td style="padding:6px 0;border-top:1px solid rgba(11,28,57,0.08);color:rgba(11,28,57,0.5);">${escapeHtml(s.email)}</td><td style="padding:6px 0;border-top:1px solid rgba(11,28,57,0.08);">${s.daysOverdue} days</td></tr>`
    )
    .join("");
  return shell(`
    <p style="margin:0 0 16px;font-weight:700;color:${NAVY_DARK};">${info.students.length} existing student${info.students.length === 1 ? " is" : "s are"} past their payment due date.</p>
    <p style="margin:0 0 16px;color:rgba(11,28,57,0.6);font-size:13px;">Nothing happens to their access automatically. If any of these already paid you directly, record their payment so their due date moves forward.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><th style="text-align:left;padding:6px 0;color:rgba(11,28,57,0.5);">Student</th><th style="text-align:left;padding:6px 0;color:rgba(11,28,57,0.5);">Email</th><th style="text-align:left;padding:6px 0;color:rgba(11,28,57,0.5);">Overdue</th></tr>
      ${rows}
    </table>
  `);
}

export function existingStudentDigestText(info: ExistingStudentDigestInfo) {
  const lines = info.students.map((s) => `- ${s.fullName} <${s.email}> — ${s.daysOverdue} days overdue`).join("\n");
  return `${info.students.length} existing student${info.students.length === 1 ? " is" : "s are"} past their payment due date.

Nothing happens to their access automatically. If any of these already paid you directly, record their payment so their due date moves forward.

${lines}`;
}

export type ExistingStudentPaymentAvailableInfo = {
  fullName: string;
  amount: number;
  currency: string;
};

export function existingStudentPaymentAvailableSubject() {
  return "You can now pay online — AngrishFrançais";
}

export function existingStudentPaymentAvailableHtml(info: ExistingStudentPaymentAvailableInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">You can now pay your monthly ${info.currency} $${info.amount.toFixed(2)} online instead of e-Transfer — pay one month at a time, or set up autopay so you never have to think about it again.</p>
    <p style="margin:0;">Find it under Subscription in your student portal.</p>
  `);
}

export function existingStudentPaymentAvailableText(info: ExistingStudentPaymentAvailableInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

You can now pay your monthly ${info.currency} $${info.amount.toFixed(2)} online instead of e-Transfer — pay one month at a time, or set up autopay so you never have to think about it again.

Find it under Subscription in your student portal.

AngrishFrançais Team`;
}

export type ExistingStudentDueSoonInfo = {
  fullName: string;
  amount: number;
  currency: string;
  dueDateLabel: string;
  /** Absolute link to the student's Subscription page, where the Pay options live. */
  payUrl: string;
};

export function existingStudentDueSoonSubject(info: ExistingStudentDueSoonInfo) {
  return `Your monthly payment is due ${info.dueDateLabel} — AngrishFrançais`;
}

export function existingStudentDueSoonHtml(info: ExistingStudentDueSoonInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">A reminder that your monthly payment of ${info.currency} $${info.amount.toFixed(2)} is due on <strong>${escapeHtml(info.dueDateLabel)}</strong>.</p>
    <p style="margin:0 0 20px;">You can pay online any time before then — one month at a time, or set up autopay.</p>
    <p style="margin:0 0 20px;"><a href="${escapeHtml(info.payUrl)}" style="display:inline-block;background:${RED};color:#ffffff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">Pay Now</a></p>
    <p style="margin:0;color:rgba(11,28,57,0.6);font-size:13px;">Already paid? Thank you — no action needed.</p>
  `);
}

export function existingStudentDueSoonText(info: ExistingStudentDueSoonInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

A reminder that your monthly payment of ${info.currency} $${info.amount.toFixed(2)} is due on ${info.dueDateLabel}.

You can pay online any time before then — one month at a time, or set up autopay:
${info.payUrl}

Already paid? Thank you — no action needed.

AngrishFrançais Team`;
}

export type SubscriptionPaymentFailedInfo = {
  fullName: string;
  amount: number;
  currency: string;
};

export function subscriptionPaymentFailedSubject() {
  return "Your payment didn't go through — AngrishFrançais";
}

export function subscriptionPaymentFailedHtml(info: SubscriptionPaymentFailedInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">We tried to charge ${info.currency} $${info.amount.toFixed(2)} and it didn't go through. Your access is still active — we'll automatically try again.</p>
    <p style="margin:0;">To avoid any interruption, please check that your card on file is up to date from your Subscription page.</p>
  `);
}

export function subscriptionPaymentFailedText(info: SubscriptionPaymentFailedInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

We tried to charge ${info.currency} $${info.amount.toFixed(2)} and it didn't go through. Your access is still active — we'll automatically try again.

To avoid any interruption, please check that your card on file is up to date from your Subscription page.

AngrishFrançais Team`;
}

export type SubscriptionTrialEndingInfo = {
  fullName: string;
  amount: number;
  currency: string;
  firstChargeDate: string;
};

export function subscriptionTrialEndingSubject() {
  return "Your free trial ends soon — AngrishFrançais";
}

export function subscriptionTrialEndingHtml(info: SubscriptionTrialEndingInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your 7-day free trial ends soon. On ${escapeHtml(info.firstChargeDate)} your card on file will be charged ${info.currency} $${info.amount.toFixed(2)}, then the same amount monthly until you cancel.</p>
    <p style="margin:0;">Nothing to do if you'd like to continue. You can cancel any time before then from your Subscription page with no charge.</p>
  `);
}

export function subscriptionTrialEndingText(info: SubscriptionTrialEndingInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your 7-day free trial ends soon. On ${info.firstChargeDate} your card on file will be charged ${info.currency} $${info.amount.toFixed(2)}, then the same amount monthly until you cancel.

Nothing to do if you'd like to continue. You can cancel any time before then from your Subscription page with no charge.

AngrishFrançais Team`;
}

export type SubscriptionRenewalUpcomingInfo = {
  fullName: string;
  amount: number;
  currency: string;
  renewalDate: string;
};

export function subscriptionRenewalUpcomingSubject() {
  return "Upcoming renewal — AngrishFrançais";
}

export function subscriptionRenewalUpcomingHtml(info: SubscriptionRenewalUpcomingInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Just a heads up — your card on file will be charged ${info.currency} $${info.amount.toFixed(2)} on ${escapeHtml(info.renewalDate)} for your next month.</p>
    <p style="margin:0;">Nothing to do if that looks right. You can review or cancel any time from your Subscription page.</p>
  `);
}

export function subscriptionRenewalUpcomingText(info: SubscriptionRenewalUpcomingInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Just a heads up — your card on file will be charged ${info.currency} $${info.amount.toFixed(2)} on ${info.renewalDate} for your next month.

Nothing to do if that looks right. You can review or cancel any time from your Subscription page.

AngrishFrançais Team`;
}

export type SubscriptionAccessSuspendedInfo = {
  fullName: string;
  amount: number;
  currency: string;
};

export function subscriptionAccessSuspendedSubject() {
  return "Your access has been paused — AngrishFrançais";
}

export function subscriptionAccessSuspendedHtml(info: SubscriptionAccessSuspendedInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your payment of ${info.currency} $${info.amount.toFixed(2)} is now several days overdue, so your access has been temporarily paused. Your seat is still being held.</p>
    <p style="margin:0;">Update your payment method from your Subscription page to restore access immediately. If payment isn't received within two weeks of the original due date, your seat will be released.</p>
  `);
}

export function subscriptionAccessSuspendedText(info: SubscriptionAccessSuspendedInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your payment of ${info.currency} $${info.amount.toFixed(2)} is now several days overdue, so your access has been temporarily paused. Your seat is still being held.

Update your payment method from your Subscription page to restore access immediately. If payment isn't received within two weeks of the original due date, your seat will be released.

AngrishFrançais Team`;
}

export type SubscriptionAccessRevokedInfo = {
  fullName: string;
  courseName: string;
};

export function subscriptionAccessRevokedSubject() {
  return "Your access and seat have been released — AngrishFrançais";
}

export function subscriptionAccessRevokedHtml(info: SubscriptionAccessRevokedInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Your payment for <strong>${escapeHtml(info.courseName)}</strong> remained unpaid for two weeks, so your access has ended and your seat has been released to other students.</p>
    <p style="margin:0;">You're welcome to sign up again any time — note a new signup won't be eligible for another free trial on the same email or card.</p>
  `);
}

export function subscriptionAccessRevokedText(info: SubscriptionAccessRevokedInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Your payment for ${info.courseName} remained unpaid for two weeks, so your access has ended and your seat has been released to other students.

You're welcome to sign up again any time — note a new signup won't be eligible for another free trial on the same email or card.

AngrishFrançais Team`;
}

export type ReferralRewardEarnedInfo = {
  fullName: string;
  amount: number;
  currency: string;
};

export function referralRewardEarnedSubject() {
  return "You earned a referral reward — AngrishFrançais";
}

export function referralRewardEarnedHtml(info: ReferralRewardEarnedInfo) {
  const first = escapeHtml(info.fullName.split(" ")[0] || info.fullName);
  return shell(`
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Good news — someone you referred just made their first payment, so you've earned ${info.currency} $${info.amount.toFixed(2)} off your next invoice.</p>
    <p style="margin:0;">It'll apply automatically — nothing for you to do.</p>
  `);
}

export function referralRewardEarnedText(info: ReferralRewardEarnedInfo) {
  return `Hi ${info.fullName.split(" ")[0] || info.fullName},

Good news — someone you referred just made their first payment, so you've earned ${info.currency} $${info.amount.toFixed(2)} off your next invoice.

It'll apply automatically — nothing for you to do.

AngrishFrançais Team`;
}
