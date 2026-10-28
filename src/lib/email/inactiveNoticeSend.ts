import "server-only";
import { createHash } from "node:crypto";
import { getFromAddress, getResendClient } from "./resend";
import { INACTIVE_NOTICE } from "./inactiveNoticeConstants";
import {
  classifyResendError,
  findNoticeConfigProblems,
  mapBatchResponse,
  renderInactiveNotice,
  type NoticeProblem,
} from "./inactiveNotice";

/** Everything that must be true before any real email goes out. Empty list = fine. Tells the admin which thing is wrong. */
export function currentNoticeProblems(): NoticeProblem[] {
  return findNoticeConfigProblems({
    apiKeyPresent: Boolean(process.env.RESEND_API_KEY),
    appFromAddress: getFromAddress(),
  });
}

export type BatchItem = { rowId: string; email: string; fullName: string | null };

export type NoticeBatchResult = { rowId: string; ok: true; resendId: string } | { rowId: string; ok: false; error: string };

export type NoticeBatchOutcome =
  | { kind: "ok"; results: NoticeBatchResult[] }
  | { kind: "stopped"; reason: "quota" | "rate_limit" | "other"; message: string };

/** Same chunk of rows => same key, so a repeated request (double click, retry after a crash) cannot send twice. */
export function idempotencyKeyFor(runId: string, rowIds: string[]): string {
  const digest = createHash("sha1").update([...rowIds].sort().join(",")).digest("hex");
  return `inactive-notice/${runId}/${digest}`;
}

/**
 * One Resend batch request (<= 100 emails; callers send 25). Each email is personalised, so each is its own item.
 * NO retry loop: a quota / rate-limit / other request-level failure is reported as "stopped" and the caller leaves the rows pending.
 * Per-email rejections (for example one invalid address) come back as failed results without stopping the run.
 */
export async function sendNoticeBatch(items: BatchItem[], runId: string): Promise<NoticeBatchOutcome> {
  const resend = getResendClient();
  if (!resend) return { kind: "stopped", reason: "other", message: "RESEND_API_KEY is not set." };

  const payload = items.map((item) => {
    const mail = renderInactiveNotice(item.fullName);
    return { from: INACTIVE_NOTICE.from, to: item.email, subject: mail.subject, html: mail.html, text: mail.text };
  });

  try {
    const response = await resend.batch.send(payload, {
      batchValidation: "permissive",
      idempotencyKey: idempotencyKeyFor(runId, items.map((i) => i.rowId)),
    });

    if (response.error) {
      const reason = classifyResendError(response.error);
      return {
        kind: "stopped",
        reason,
        message:
          reason === "quota"
            ? "Resend's sending limit for your plan has been reached. Nothing more was sent; the rest are still pending. Try again after the limit resets, or upgrade the plan."
            : reason === "rate_limit"
              ? "Resend asked us to slow down (rate limit). Nothing more was sent; the rest are still pending. Wait a minute, then resume."
              : `Resend rejected the request: ${response.error.message}. Nothing more was sent; the rest are still pending.`,
      };
    }

    const body = response.data as { data?: { id: string }[]; errors?: { index: number; message: string }[] } | null;
    const mapped = mapBatchResponse(items.length, body?.data, body?.errors);
    return {
      kind: "ok",
      results: mapped.map((m) =>
        m.ok ? { rowId: items[m.index].rowId, ok: true as const, resendId: m.id } : { rowId: items[m.index].rowId, ok: false as const, error: m.error }
      ),
    };
  } catch (error) {
    console.error("[InactiveNotice] Resend batch request failed:", error);
    return { kind: "stopped", reason: "other", message: "The request to Resend failed (network error). Nothing more was sent; the rest are still pending." };
  }
}

/** The preview: the exact same email, sent once, to the signed-in admin's own address. */
export async function sendNoticePreview(toEmail: string, fullName: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResendClient();
  if (!resend) return { ok: false, error: "RESEND_API_KEY is not set." };
  const mail = renderInactiveNotice(fullName);
  try {
    const { error } = await resend.emails.send({
      from: INACTIVE_NOTICE.from,
      to: toEmail,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    console.error("[InactiveNotice] Preview send failed:", error);
    return { ok: false, error: "The request to Resend failed." };
  }
}
