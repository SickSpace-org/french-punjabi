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
    <title>French Punjabi</title>
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
                  French<span style="color:${RED};">Punjabi</span>
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
                French Punjabi Team
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
  return "Enrollment Request Received — French Punjabi";
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
    <p style="margin:0 0 16px;">Thank you for your interest in French Punjabi.</p>
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
    <p style="margin:24px 0 0;">Regards,<br />French Punjabi Team</p>
  `);
}

export function enrollmentConfirmationText(info: PaymentEmailInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "Thank you for your interest in French Punjabi.",
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
    "French Punjabi Team",
  ].join("\n");
}

export function paymentConfirmedSubject() {
  return "Enrollment Confirmed — French Punjabi";
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
      Your payment has been received and your enrollment with French Punjabi
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
    <p style="margin:24px 0 0;">Thank you,<br />French Punjabi Team</p>
  `);
}

export function paymentConfirmedText(info: PaymentEmailInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "Your payment has been received and your enrollment with French Punjabi is now confirmed.",
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
    "French Punjabi Team",
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
  return "NEW ENROLLMENT — French Punjabi";
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
  loginLink: string;
  temporaryPassword: string;
};

export function studentLoginCredentialsSubject() {
  return "Your Student Portal Access — French Punjabi";
}

export function studentLoginCredentialsHtml(info: StudentLoginCredentialsInfo) {
  const name = escapeHtml(info.fullName);
  const password = escapeHtml(info.temporaryPassword);

  return shell(`
    <p style="margin:0 0 16px;">Hello ${name},</p>
    <p style="margin:0 0 16px;">Here&rsquo;s access to your French Punjabi Student Portal.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;">
      <tr>
        <td style="padding:16px 0;text-align:center;">
          <a href="${info.loginLink}" style="display:inline-block;background:${RED};color:#ffffff;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">
            Open Student Portal
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;">
      If that button doesn&rsquo;t work, you can also sign in manually with a password:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-left:4px solid ${RED};background:${CREAM_DIM};border-radius:8px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0;color:rgba(11,28,57,0.5);font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Password</p>
          <p style="margin:2px 0 0;font-weight:700;color:${NAVY};font-size:16px;">${password}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px;">
      Go to the Student Login page, choose &ldquo;Have a password instead?&rdquo;, and sign in with your
      email and this password.
    </p>
    <p style="margin:24px 0 0;">Regards,<br />French Punjabi Team</p>
  `);
}

export function studentLoginCredentialsText(info: StudentLoginCredentialsInfo) {
  return [
    `Hello ${info.fullName},`,
    "",
    "Here's access to your French Punjabi Student Portal.",
    "",
    "Open your portal:",
    info.loginLink,
    "",
    "Or sign in manually with a password:",
    `Password: ${info.temporaryPassword}`,
    "",
    "Go to the Student Login page, choose \"Have a password instead?\", and sign in with your email and this password.",
    "",
    "Regards,",
    "French Punjabi Team",
  ].join("\n");
}
