import { Resend } from "resend";

/**
 * Lazily constructed so a missing RESEND_API_KEY never crashes module load
 * (e.g. at build time, or before the integration is configured) — callers
 * check getResendClient() for null and skip sending instead.
 */
let client: Resend | null | undefined;

export function getResendClient(): Resend | null {
  if (client !== undefined) return client;
  const apiKey = process.env.RESEND_API_KEY;
  client = apiKey ? new Resend(apiKey) : null;
  return client;
}

/** Resend's shared test domain — works without verifying your own domain,
 * useful before RESEND_FROM_EMAIL / domain verification is set up. */
const SANDBOX_FROM = "AngrishFrançais <onboarding@resend.dev>";

export function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || SANDBOX_FROM;
}

export function getAdminNotificationEmail(): string | null {
  return process.env.ADMIN_NOTIFICATION_EMAIL || null;
}
