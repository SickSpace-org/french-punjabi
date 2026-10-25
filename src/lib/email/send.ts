import { getAdminNotificationEmail, getFromAddress, getResendClient } from "./resend";
import {
  adminNotificationHtml,
  adminNotificationSubject,
  enrollmentConfirmationHtml,
  enrollmentConfirmationSubject,
  enrollmentConfirmationText,
  feeReminderHtml,
  feeReminderSubject,
  feeReminderText,
  paymentConfirmedHtml,
  paymentConfirmedSubject,
  paymentConfirmedText,
  paymentReminderHtml,
  paymentReminderSubject,
  paymentReminderText,
  studentLoginCredentialsHtml,
  studentLoginCredentialsSubject,
  studentLoginCredentialsText,
  studentPortalAccessHtml,
  studentPortalAccessSubject,
  studentPortalAccessText,
  teacherPortalAccessHtml,
  teacherPortalAccessSubject,
  teacherPortalAccessText,
  newTicketNotificationHtml,
  newTicketNotificationSubject,
  ticketReplyNotificationHtml,
  ticketReplyNotificationSubject,
  ticketReplyNotificationText,
  adminWaitlistHtml,
  adminWaitlistSubject,
  seatOpenHtml,
  seatOpenSubject,
  seatOpenText,
  waitlistJoinedHtml,
  waitlistJoinedSubject,
  waitlistJoinedText,
  subscriptionWelcomeHtml,
  subscriptionWelcomeSubject,
  subscriptionWelcomeText,
  subscriptionLostRaceHtml,
  subscriptionLostRaceSubject,
  subscriptionLostRaceText,
  subscriptionTrialStartedHtml,
  subscriptionTrialStartedSubject,
  subscriptionTrialStartedText,
  subscriptionPaymentSucceededHtml,
  subscriptionPaymentSucceededSubject,
  subscriptionPaymentSucceededText,
  subscriptionCanceledHtml,
  subscriptionCanceledSubject,
  subscriptionCanceledText,
  phaseCompletedHtml,
  phaseCompletedSubject,
  phaseCompletedText,
  subscriptionDuplicateTrialCardHtml,
  subscriptionDuplicateTrialCardSubject,
  subscriptionDuplicateTrialCardText,
  paymentOverdueReminderHtml,
  paymentOverdueReminderSubject,
  paymentOverdueReminderText,
  adminPaymentAlertHtml,
  adminPaymentAlertSubject,
  adminPaymentAlertText,
  subscriptionPaymentFailedHtml,
  subscriptionPaymentFailedSubject,
  subscriptionPaymentFailedText,
  subscriptionTrialEndingHtml,
  subscriptionTrialEndingSubject,
  subscriptionTrialEndingText,
  subscriptionRenewalUpcomingHtml,
  subscriptionRenewalUpcomingSubject,
  subscriptionRenewalUpcomingText,
  subscriptionAccessSuspendedHtml,
  subscriptionAccessSuspendedSubject,
  subscriptionAccessSuspendedText,
  subscriptionAccessRevokedHtml,
  subscriptionAccessRevokedSubject,
  subscriptionAccessRevokedText,
  referralRewardEarnedHtml,
  referralRewardEarnedSubject,
  referralRewardEarnedText,
  existingStudentDigestHtml,
  existingStudentDigestSubject,
  existingStudentDigestText,
  existingStudentPaymentAvailableHtml,
  existingStudentPaymentAvailableSubject,
  existingStudentPaymentAvailableText,
  existingStudentDueSoonSubject,
  existingStudentDueSoonHtml,
  existingStudentDueSoonText,
  fullPaymentWelcomeHtml,
  fullPaymentWelcomeSubject,
  fullPaymentWelcomeText,
  type ExistingStudentDigestInfo,
  type ExistingStudentPaymentAvailableInfo,
  type FullPaymentWelcomeInfo,
  type AdminNotificationInfo,
  type AdminWaitlistInfo,
  type WaitlistEmailInfo,
  type SubscriptionWelcomeInfo,
  type SubscriptionLostRaceInfo,
  type SubscriptionTrialStartedInfo,
  type SubscriptionPaymentSucceededInfo,
  type SubscriptionCanceledInfo,
  type PhaseCompletedInfo,
  type SubscriptionDuplicateTrialCardInfo,
  type PaymentOverdueReminderInfo,
  type AdminPaymentAlertInfo,
  type SubscriptionPaymentFailedInfo,
  type SubscriptionTrialEndingInfo,
  type SubscriptionRenewalUpcomingInfo,
  type SubscriptionAccessSuspendedInfo,
  type SubscriptionAccessRevokedInfo,
  type ReferralRewardEarnedInfo,
  type FeeReminderInfo,
  type NewTicketNotificationInfo,
  type PaymentEmailInfo,
  type ExistingStudentDueSoonInfo,
  type StudentLoginCredentialsInfo,
  type StudentPortalAccessInfo,
  type TeacherPortalAccessInfo,
  type TicketReplyNotificationInfo,
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

/**
 * Sent on-demand when an admin clicks "Send Payment Reminder" on a
 * PENDING-payment enrollment (see sendPaymentReminder in
 * enrollments/actions.ts). Unlike the other emails here, this one is
 * admin-triggered rather than automatic, and can be sent more than once.
 */
export async function sendPaymentReminderEmail(to: string, info: PaymentEmailInfo): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping payment-reminder email.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: paymentReminderSubject(),
      html: paymentReminderHtml(info),
      text: paymentReminderText(info),
    });
    if (error) {
      console.error("[Email] Failed to send payment-reminder email:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending payment-reminder email:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}

/**
 * Sent on-demand when an admin clicks "Send Fee Reminder" for an
 * already-enrolled student on the Students tab (see sendFeeReminder in
 * students/[studentId]/actions.ts) — distinct from sendPaymentReminderEmail
 * above, which is only for a still-PENDING enrollment's initial signup
 * payment. Can be sent more than once, e.g. every month.
 */
export async function sendFeeReminderEmail(to: string, info: FeeReminderInfo): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping fee-reminder email.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: feeReminderSubject(),
      html: feeReminderHtml(info),
      text: feeReminderText(info),
    });
    if (error) {
      console.error("[Email] Failed to send fee-reminder email:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending fee-reminder email:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}

/**
 * Sent when an admin sets a temporary password for a student (see
 * setTemporaryPassword) — carries both a ready-to-click sign-in link and
 * the password as a manual fallback, so the admin never has to relay
 * credentials by hand. Best-effort, same as every other email helper here.
 */
export async function sendStudentLoginCredentials(
  to: string,
  info: StudentLoginCredentialsInfo
): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping login-credentials email.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: studentLoginCredentialsSubject(),
      html: studentLoginCredentialsHtml(info),
      text: studentLoginCredentialsText(info),
    });
    if (error) {
      console.error("[Email] Failed to send login-credentials email:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending login-credentials email:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}

/**
 * Sent once, automatically, right after an admin confirms payment (see
 * inviteStudentAndLink) — the student's only onboarding step is clicking
 * this one link, no password or code required. Also resendable/regenerable
 * from the admin panel (see the students detail actions).
 */
export async function sendStudentPortalAccess(
  to: string,
  info: StudentPortalAccessInfo
): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping portal-access email.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: studentPortalAccessSubject(),
      html: studentPortalAccessHtml(info),
      text: studentPortalAccessText(info),
    });
    if (error) {
      console.error("[Email] Failed to send portal-access email:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending portal-access email:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}

/**
 * Sent once, automatically, right after an admin adds a teacher (see
 * inviteTeacherAndLink) — mirrors sendStudentPortalAccess exactly, just for
 * the Teacher Portal instead.
 */
export async function sendTeacherPortalAccess(
  to: string,
  info: TeacherPortalAccessInfo
): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping teacher portal-access email.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: teacherPortalAccessSubject(),
      html: teacherPortalAccessHtml(info),
      text: teacherPortalAccessText(info),
    });
    if (error) {
      console.error("[Email] Failed to send teacher portal-access email:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending teacher portal-access email:", error);
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

/** Optional — only sends if ADMIN_NOTIFICATION_EMAIL is configured, same
 * gating as sendAdminNotification above. Never blocks or fails ticket
 * creation either way — called best-effort from student_open_ticket's
 * caller. */
export async function sendNewTicketNotification(info: NewTicketNotificationInfo): Promise<SendResult> {
  const adminEmail = getAdminNotificationEmail();
  if (!adminEmail) return { sent: false, reason: "not_configured" };

  const resend = getResendClient();
  if (!resend) return { sent: false, reason: "not_configured" };

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to: adminEmail,
      subject: newTicketNotificationSubject(),
      html: newTicketNotificationHtml(info),
    });
    if (error) {
      console.error("[Email] Failed to send new-ticket notification:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending new-ticket notification:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}

/**
 * The one asymmetric addition in this feature: nothing else in the
 * portal (teacher messages, feedback notes) emails a student when new
 * content arrives for them — but a support ticket means the student is
 * actively waiting on an answer, so leaving them to manually recheck the
 * portal defeats the point. Best-effort, never blocks the reply action.
 */
export async function sendTicketReplyNotification(to: string, info: TicketReplyNotificationInfo): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not configured — skipping ticket-reply email.");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: ticketReplyNotificationSubject(),
      html: ticketReplyNotificationHtml(info),
      text: ticketReplyNotificationText(info),
    });
    if (error) {
      console.error("[Email] Failed to send ticket-reply email:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[Email] Unexpected error sending ticket-reply email:", error);
    return { sent: false, reason: "unexpected_error" };
  }
}

/** Tells a student they're on a full batch's waitlist. Best-effort. */
export async function sendWaitlistJoinedEmail(to: string, info: WaitlistEmailInfo): Promise<SendResult> {
  return sendSimple("waitlist confirmation", {
    to,
    subject: waitlistJoinedSubject(),
    html: waitlistJoinedHtml(info),
    text: waitlistJoinedText(info),
  });
}

/** Tells a waitlisted student a seat opened in their batch. Best-effort. */
export async function sendSeatOpenEmail(to: string, info: WaitlistEmailInfo): Promise<SendResult> {
  return sendSimple("seat-open notice", {
    to,
    subject: seatOpenSubject(),
    html: seatOpenHtml(info),
    text: seatOpenText(info),
  });
}

/** Public Enroll cutover — one-time "Full" payment welcome (no trial, no renewal). Best-effort. */
export async function sendFullPaymentWelcomeEmail(to: string, info: FullPaymentWelcomeInfo): Promise<SendResult> {
  return sendSimple("full-payment welcome", {
    to,
    subject: fullPaymentWelcomeSubject(),
    html: fullPaymentWelcomeHtml(info),
    text: fullPaymentWelcomeText(info),
  });
}

/** Confirms a successful Stripe subscription signup. Best-effort — the webhook handler schedules this via after(), never awaits it inline. */
export async function sendSubscriptionWelcomeEmail(to: string, info: SubscriptionWelcomeInfo): Promise<SendResult> {
  return sendSimple("subscription welcome", {
    to,
    subject: subscriptionWelcomeSubject(),
    html: subscriptionWelcomeHtml(info),
    text: subscriptionWelcomeText(info),
  });
}

/** Tells a student their just-completed payment was cancelled/refunded because they lost the last-seat race, and that they're now waitlisted. Best-effort. */
export async function sendSubscriptionLostRaceEmail(to: string, info: SubscriptionLostRaceInfo): Promise<SendResult> {
  return sendSimple("lost-race waitlist notice", {
    to,
    subject: subscriptionLostRaceSubject(),
    html: subscriptionLostRaceHtml(info),
    text: subscriptionLostRaceText(info),
  });
}

/** Stage 2 — sent instead of sendSubscriptionWelcomeEmail when this signup is a trial (no charge happened today). Best-effort. */
export async function sendSubscriptionTrialStartedEmail(to: string, info: SubscriptionTrialStartedInfo): Promise<SendResult> {
  return sendSimple("trial started", {
    to,
    subject: subscriptionTrialStartedSubject(),
    html: subscriptionTrialStartedHtml(info),
    text: subscriptionTrialStartedText(info),
  });
}

/** Stage 2 — invoice.payment_succeeded, covers both the day-8 first charge and every later monthly renewal. Best-effort. */
export async function sendSubscriptionPaymentSucceededEmail(to: string, info: SubscriptionPaymentSucceededInfo): Promise<SendResult> {
  return sendSimple("payment succeeded", {
    to,
    subject: subscriptionPaymentSucceededSubject(),
    html: subscriptionPaymentSucceededHtml(info),
    text: subscriptionPaymentSucceededText(info),
  });
}

/** Stage 2 — customer.subscription.deleted, including cancellation during the trial. Best-effort. */
export async function sendSubscriptionCanceledEmail(to: string, info: SubscriptionCanceledInfo): Promise<SendResult> {
  return sendSimple("subscription cancelled", {
    to,
    subject: subscriptionCanceledSubject(),
    html: subscriptionCanceledHtml(info),
    text: subscriptionCanceledText(info),
  });
}

/** A subscription's day-90 cap (see phaseLength.ts) reaching its scheduled
 * end — distinct from sendSubscriptionCanceledEmail above, which this
 * replaces for that one case so a clean phase completion doesn't read
 * like an opt-out. Best-effort. */
export async function sendPhaseCompletedEmail(to: string, info: PhaseCompletedInfo): Promise<SendResult> {
  return sendSimple("phase completed", {
    to,
    subject: phaseCompletedSubject(info),
    html: phaseCompletedHtml(info),
    text: phaseCompletedText(info),
  });
}

/** Stage 2 — this signup's card already used a trial under a different email; subscription was cancelled, never charged. Best-effort. */
export async function sendSubscriptionDuplicateTrialCardEmail(to: string, info: SubscriptionDuplicateTrialCardInfo): Promise<SendResult> {
  return sendSimple("duplicate trial card", {
    to,
    subject: subscriptionDuplicateTrialCardSubject(),
    html: subscriptionDuplicateTrialCardHtml(info),
    text: subscriptionDuplicateTrialCardText(info),
  });
}

/** Checkpoint 1 — days 1-3 of the overdue window, sent by the daily lifecycle sweep. Best-effort. */
export async function sendPaymentOverdueReminderEmail(to: string, info: PaymentOverdueReminderInfo): Promise<SendResult> {
  return sendSimple("payment overdue reminder", {
    to,
    subject: paymentOverdueReminderSubject(),
    html: paymentOverdueReminderHtml(info),
    text: paymentOverdueReminderText(info),
  });
}

/** Checkpoint 2 — charge.refunded / charge.dispute.created. Best-effort; never gates on this succeeding. */
export async function sendAdminPaymentAlert(info: AdminPaymentAlertInfo): Promise<SendResult> {
  const adminEmail = getAdminNotificationEmail();
  if (!adminEmail) return { sent: false, reason: "not_configured" };
  return sendSimple("admin payment alert", {
    to: adminEmail,
    subject: adminPaymentAlertSubject(info),
    html: adminPaymentAlertHtml(info),
    text: adminPaymentAlertText(info),
  });
}

/** Checkpoint 3 — daily digest of existing (non-Stripe) students who are 3
 * days past due, so unrecorded payments can be caught (gates-respecting;
 * only called at all when the list is non-empty). Informational only — no
 * automatic action follows. Best-effort. */
export async function sendExistingStudentDigest(info: ExistingStudentDigestInfo): Promise<SendResult> {
  const adminEmail = getAdminNotificationEmail();
  if (!adminEmail) return { sent: false, reason: "not_configured" };
  return sendSimple("existing-student digest", {
    to: adminEmail,
    subject: existingStudentDigestSubject(info),
    html: existingStudentDigestHtml(info),
    text: existingStudentDigestText(info),
  });
}

/** Checkpoint 3, item 7 — the one-time "you can now pay online"
 * announcement for an existing student. The in-portal notification is the
 * primary channel (see insertPaymentNotification callers) — this email is
 * best-effort on top of that, same as everywhere else, and currently
 * unverifiable end-to-end since Resend is in sandbox mode. */
export async function sendExistingStudentPaymentAvailableEmail(to: string, info: ExistingStudentPaymentAvailableInfo): Promise<SendResult> {
  return sendSimple("existing-student payment available", {
    to,
    subject: existingStudentPaymentAvailableSubject(),
    html: existingStudentPaymentAvailableHtml(info),
    text: existingStudentPaymentAvailableText(info),
  });
}

/** The neutral "your monthly payment is due on <date>" notice for an existing
 * (non-Stripe) student — due date plus a Pay link, no consequence promised.
 * The in-portal notification is the primary channel; this is best-effort. */
export async function sendExistingStudentDueSoonEmail(to: string, info: ExistingStudentDueSoonInfo): Promise<SendResult> {
  return sendSimple("existing-student due soon", {
    to,
    subject: existingStudentDueSoonSubject(info),
    html: existingStudentDueSoonHtml(info),
    text: existingStudentDueSoonText(info),
  });
}

/** Tells the admin someone joined a full batch's waitlist. Best-effort. */
export async function sendAdminWaitlistNotification(info: AdminWaitlistInfo): Promise<SendResult> {
  const adminEmail = getAdminNotificationEmail();
  if (!adminEmail) return { sent: false, reason: "not_configured" };
  return sendSimple("admin waitlist notification", {
    to: adminEmail,
    subject: adminWaitlistSubject(),
    html: adminWaitlistHtml(info),
  });
}

/** A8 — invoice.payment_failed, sent immediately (distinct from sendPaymentOverdueReminderEmail, which the daily sweep sends once per day on days 1-3). Best-effort. */
export async function sendSubscriptionPaymentFailedEmail(to: string, info: SubscriptionPaymentFailedInfo): Promise<SendResult> {
  return sendSimple("payment failed", {
    to,
    subject: subscriptionPaymentFailedSubject(),
    html: subscriptionPaymentFailedHtml(info),
    text: subscriptionPaymentFailedText(info),
  });
}

/** A8 — customer.subscription.trial_will_end. Best-effort. */
export async function sendSubscriptionTrialEndingEmail(to: string, info: SubscriptionTrialEndingInfo): Promise<SendResult> {
  return sendSimple("trial ending", {
    to,
    subject: subscriptionTrialEndingSubject(),
    html: subscriptionTrialEndingHtml(info),
    text: subscriptionTrialEndingText(info),
  });
}

/** A8 — invoice.upcoming, an established (non-trial) subscriber's next renewal. Best-effort. */
export async function sendSubscriptionRenewalUpcomingEmail(to: string, info: SubscriptionRenewalUpcomingInfo): Promise<SendResult> {
  return sendSimple("renewal upcoming", {
    to,
    subject: subscriptionRenewalUpcomingSubject(),
    html: subscriptionRenewalUpcomingHtml(info),
    text: subscriptionRenewalUpcomingText(info),
  });
}

/** A8 — day-4 SUSPENDED transition from the daily lifecycle sweep. Best-effort. */
export async function sendSubscriptionAccessSuspendedEmail(to: string, info: SubscriptionAccessSuspendedInfo): Promise<SendResult> {
  return sendSimple("access suspended", {
    to,
    subject: subscriptionAccessSuspendedSubject(),
    html: subscriptionAccessSuspendedHtml(info),
    text: subscriptionAccessSuspendedText(info),
  });
}

/** A8 — day-14 INACTIVE transition from the daily lifecycle sweep (seat released). Best-effort. */
export async function sendSubscriptionAccessRevokedEmail(to: string, info: SubscriptionAccessRevokedInfo): Promise<SendResult> {
  return sendSimple("access revoked", {
    to,
    subject: subscriptionAccessRevokedSubject(),
    html: subscriptionAccessRevokedHtml(info),
    text: subscriptionAccessRevokedText(info),
  });
}

/** A8 — tells the REFERRER their $25 reward was just earned (after the referred student's first payment succeeded). Best-effort. */
export async function sendReferralRewardEarnedEmail(to: string, info: ReferralRewardEarnedInfo): Promise<SendResult> {
  return sendSimple("referral reward earned", {
    to,
    subject: referralRewardEarnedSubject(),
    html: referralRewardEarnedHtml(info),
    text: referralRewardEarnedText(info),
  });
}

async function sendSimple(
  what: string,
  message: { to: string; subject: string; html: string; text?: string }
): Promise<SendResult> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(`[Email] RESEND_API_KEY not configured — skipping ${what}.`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    const { error } = await resend.emails.send({ from: getFromAddress(), ...message });
    if (error) {
      console.error(`[Email] Failed to send ${what}:`, error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error(`[Email] Unexpected error sending ${what}:`, error);
    return { sent: false, reason: "unexpected_error" };
  }
}
