import { getAdminNotificationEmail, getFromAddress, getResendClient } from "./resend";
import {
  adminNotificationHtml,
  adminNotificationSubject,
  enrollmentConfirmationHtml,
  enrollmentConfirmationSubject,
  enrollmentConfirmationText,
  paymentConfirmedHtml,
  paymentConfirmedSubject,
  paymentConfirmedText,
  type AdminNotificationInfo,
  type PaymentEmailInfo,
} from "./templates";

export type SendResult = { sent: boolean; reason?: string };

/**
 * Best-effort — callers must not let a failure here undo or hide an
 * already-saved enrollment. Errors are logged, never thrown. Sent right
 * after a student submits the form — must NOT say they are enrolled yet,
 * only that payment instructions follow.
 */
export async function sendEnrollmentConfirmation(
  to: string,
  info: PaymentEmailInfo
): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping confirmation email.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: enrollmentConfirmationSubject(),
      html: enrollmentConfirmationHtml(info),
      text: enrollmentConfirmationText(info),
    });
    if (error) {
      console.error("[Email] Failed to send enrollment confirmation:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending enrollment confirmation:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}

/**
 * Sent only once, right after an admin manually confirms the Interac
 * e-Transfer arrived (see confirmEnrollmentPayment). Best-effort — a
 * failure here must never undo the payment confirmation itself.
 */
export async function sendPaymentConfirmedEmail(to: string, info: PaymentEmailInfo): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping payment-confirmed email.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: paymentConfirmedSubject(),
      html: paymentConfirmedHtml(info),
      text: paymentConfirmedText(info),
    });
    if (error) {
      console.error("[Email] Failed to send payment-confirmed email:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending payment-confirmed email:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}

/** Optional — only sends if ADMIN_NOTIFICATION_EMAIL is configured. Never
 * blocks or fails the enrollment flow either way. */
export async function sendAdminNotification(info: AdminNotificationInfo): Promise<SendResult> {
  const adminEmail = getAdminNotificationEmail();
  if (!adminEmail) return { sent: false, reason: "not_configured" };

  const resend = getResendClient();
  if (!resend) return { sent: false, reason: "not_configured" };

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: adminEmail,
      subject: adminNotificationSubject(),
      html: adminNotificationHtml(info),
    });
    if (error) {
      console.error("[Email] Failed to send admin notification:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending admin notification:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}
