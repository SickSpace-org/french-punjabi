"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentNoticeProblems, sendNoticeBatch, sendNoticePreview, type BatchItem } from "@/lib/email/inactiveNoticeSend";
import {
  isMissingTableError,
  isRecipientAllowedHere,
  normalizeEmail,
  renderInactiveNotice,
  selectRecipients,
  type NoticeProblem,
  type NoticeStudent,
  type SkippedCounts,
} from "@/lib/email/inactiveNotice";
import { NOTICE_CHUNK_SIZE, NOTICE_REPEAT_DAYS, NOTICE_STALE_PENDING_HOURS } from "@/lib/email/inactiveNoticeConstants";

/**
 * "Email N students" on the Inactive Students page. Every action here:
 *   - re-checks on the SERVER that the caller is a signed-in admin (admin_users row), whatever the page showed;
 *   - re-reads the INACTIVE students from the database itself. The browser only says WHICH students (ids, taken from the
 *     filtered list on screen); email addresses and names always come from the database, never from the browser;
 *   - writes the send record with the service-role client, because the log table has no write access for browser sessions.
 */

type Admin = { userId: string; email: string | null };

async function requireAdmin(): Promise<({ ok: true } & Admin) | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: adminRow } = await supabase.from("admin_users").select("id").eq("id", user.id).maybeSingle();
  if (!adminRow) return { ok: false, error: "Not authorized." };

  return { ok: true, userId: user.id, email: user.email ?? null };
}

const MAX_IDS = 5000;

function cleanIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length > MAX_IDS) return null;
  const ids = new Set<string>();
  for (const value of input) {
    if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) return null;
    ids.add(value.toLowerCase());
  }
  return [...ids];
}

/** Every INACTIVE student, read fresh from the database (paged, so more than 1000 rows still works). */
async function loadInactiveStudents(): Promise<NoticeStudent[]> {
  const supabase = await createClient();
  const rows: NoticeStudent[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name, email")
      .eq("status", "INACTIVE")
      .order("enrolled_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []).map((s) => ({ id: s.id, full_name: s.full_name, email: s.email })));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Student ids that already got this email within the last 30 days. logReady:false when migration 062 is not applied. */
async function loadRecentlyEmailed(): Promise<{ logReady: boolean; ids: Set<string> }> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - NOTICE_REPEAT_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("inactive_notice_log")
    .select("student_id")
    .eq("status", "sent")
    .gte("sent_at", since)
    .limit(10000);
  if (error) {
    if (!isMissingTableError(error)) console.error("[InactiveNotice] Could not read the send log:", error);
    return { logReady: false, ids: new Set() };
  }
  return { logReady: true, ids: new Set((data ?? []).map((r) => r.student_id)) };
}

export type NoticePlan = {
  ok: true;
  logReady: boolean;
  /** How many of the students shown are still INACTIVE in the database. */
  found: number;
  /** Students who WOULD get the email right now. */
  willSend: number;
  /** Would be sent, but this is not the production deployment, so the development safety net holds them back. */
  blockedOutsideProduction: number;
  skipped: SkippedCounts & { notInactive: number };
  problems: NoticeProblem[];
  /** Dry run only: every email was rendered; how many rendered cleanly, plus the first one as a sample. */
  dryRun?: { rendered: number; renderFailures: number; sample: { to: string; subject: string; text: string } | null };
};

async function buildPlan(ids: string[]) {
  const [inactive, recent] = await Promise.all([loadInactiveStudents(), loadRecentlyEmailed()]);
  const wanted = new Set(ids);
  const shown = inactive.filter((s) => wanted.has(s.id));
  const { recipients, skipped } = selectRecipients(shown, recent.ids);
  const vercelEnv = process.env.VERCEL_ENV;
  const allowed = recipients.filter((r) => isRecipientAllowedHere(r.email, vercelEnv));
  return {
    logReady: recent.logReady,
    found: shown.length,
    notInactive: ids.length - shown.length,
    recipients: allowed,
    blocked: recipients.length - allowed.length,
    skipped,
  };
}

/**
 * Counts for the confirm dialog (dryRun false) or a full dry run (dryRun true): the emails are rendered and counted, and
 * NOTHING is sent and NOTHING is written anywhere.
 */
export async function planInactiveNotice(studentIds: string[], options?: { dryRun?: boolean }): Promise<NoticePlan | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const ids = cleanIds(studentIds);
  if (!ids) return { ok: false, error: "Invalid student list." };

  try {
    const plan = await buildPlan(ids);
    const result: NoticePlan = {
      ok: true,
      logReady: plan.logReady,
      found: plan.found,
      willSend: plan.recipients.length,
      blockedOutsideProduction: plan.blocked,
      skipped: { ...plan.skipped, notInactive: plan.notInactive },
      problems: currentNoticeProblems(),
    };

    if (options?.dryRun) {
      let rendered = 0;
      let renderFailures = 0;
      let sample: { to: string; subject: string; text: string } | null = null;
      for (const recipient of plan.recipients) {
        try {
          const mail = renderInactiveNotice(recipient.fullName);
          rendered += 1;
          if (!sample) sample = { to: recipient.email, subject: mail.subject, text: mail.text };
        } catch {
          renderFailures += 1;
        }
      }
      result.dryRun = { rendered, renderFailures, sample };
    }
    return result;
  } catch (error) {
    console.error("[InactiveNotice] Could not plan the send:", error);
    return { ok: false, error: "Could not load the inactive students. Please refresh and try again." };
  }
}

/** Sends the exact email, once, to the signed-in admin's own address. Not logged, and not subject to the 30-day rule. */
export async function sendInactiveNoticePreview(sampleStudentId?: string): Promise<{ ok: true; to: string } | { ok: false; error: string; problems?: NoticeProblem[] }> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (!admin.email || !normalizeEmail(admin.email)) return { ok: false, error: "Your admin account has no email address to send the preview to." };

  const problems = currentNoticeProblems();
  if (problems.length > 0) return { ok: false, error: "Not sent: the email is not ready.", problems };

  let fullName: string | null = null;
  if (sampleStudentId && cleanIds([sampleStudentId])) {
    const match = (await loadInactiveStudents()).find((s) => s.id === sampleStudentId.toLowerCase());
    fullName = match?.full_name ?? null;
  }

  const result = await sendNoticePreview(admin.email, fullName);
  return result.ok ? { ok: true, to: admin.email } : { ok: false, error: `Preview failed: ${result.error}` };
}

export type StartResult =
  | { ok: true; runId: string; total: number; blockedOutsideProduction: number }
  | { ok: false; error: string; problems?: NoticeProblem[] };

/**
 * Creates the send: one 'pending' log row per recipient. Nothing is emailed yet; the page then calls sendInactiveNoticeChunk
 * repeatedly. Refuses while the email is not ready, while the log table is missing, or while another send is waiting to be resumed.
 */
export async function startInactiveNotice(studentIds: string[]): Promise<StartResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const ids = cleanIds(studentIds);
  if (!ids) return { ok: false, error: "Invalid student list." };

  const problems = currentNoticeProblems();
  if (problems.length > 0) return { ok: false, error: "Not sent: the email is not ready.", problems };

  try {
    const db = createAdminClient();

    // Close out sends that were stopped and never resumed, then refuse if a fresh one is still waiting.
    const staleBefore = new Date(Date.now() - NOTICE_STALE_PENDING_HOURS * 3_600_000).toISOString();
    const { error: staleError } = await db
      .from("inactive_notice_log")
      .update({ status: "failed", error: "Abandoned: never resumed." })
      .eq("status", "pending")
      .lt("created_at", staleBefore);
    if (staleError) {
      if (isMissingTableError(staleError)) {
        return { ok: false, error: "Setup needed: the send log table does not exist yet (apply migration 062). Nothing was sent." };
      }
      throw staleError;
    }

    const { count: waiting } = await db.from("inactive_notice_log").select("id", { count: "exact", head: true }).eq("status", "pending");
    if ((waiting ?? 0) > 0) {
      return { ok: false, error: `A previous send was stopped with ${waiting} still pending. Resume it (or discard it) before starting a new one.` };
    }

    const plan = await buildPlan(ids);
    if (plan.recipients.length === 0) {
      return { ok: false, error: "Nobody to email: everyone shown is skipped (recently emailed, no valid email, or not allowed here)." };
    }

    const runId = randomUUID();
    const rows = plan.recipients.map((r) => ({ run_id: runId, student_id: r.studentId, status: "pending" as const }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("inactive_notice_log").insert(rows.slice(i, i + 500));
      if (error) throw error;
    }
    return { ok: true, runId, total: rows.length, blockedOutsideProduction: plan.blocked };
  } catch (error) {
    console.error("[InactiveNotice] Could not start the send:", error);
    return { ok: false, error: "Could not start the send. Nothing was emailed." };
  }
}

export type ChunkResult =
  | {
      ok: true;
      sent: number;
      failed: number;
      /** Pending rows left in this run. 0 = finished. */
      remaining: number;
      total: number;
      totalSent: number;
      totalFailed: number;
      sentStudentIds: string[];
      stopped?: { reason: "quota" | "rate_limit" | "other"; message: string };
    }
  | { ok: false; error: string; problems?: NoticeProblem[] };

async function runCounts(runId: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("inactive_notice_log").select("status").eq("run_id", runId);
  if (error) throw error;
  const counts = { total: data?.length ?? 0, pending: 0, sent: 0, failed: 0 };
  for (const row of data ?? []) counts[row.status] += 1;
  return counts;
}

/**
 * Sends the next chunk (up to 25) of a run through Resend's batch endpoint. On a quota or rate-limit rejection (or any
 * request-level failure) it STOPS: the rows stay 'pending' and the admin resumes later. No retry loop.
 */
export async function sendInactiveNoticeChunk(runId: string): Promise<ChunkResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId)) return { ok: false, error: "Invalid send." };

  const problems = currentNoticeProblems();
  if (problems.length > 0) return { ok: false, error: "Not sent: the email is not ready.", problems };

  try {
    const db = createAdminClient();
    const { data: pendingRows, error } = await db
      .from("inactive_notice_log")
      .select("id, student_id")
      .eq("run_id", runId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(NOTICE_CHUNK_SIZE);
    if (error) throw error;

    const rows = pendingRows ?? [];
    if (rows.length === 0) {
      const counts = await runCounts(runId);
      return { ok: true, sent: 0, failed: 0, remaining: 0, total: counts.total, totalSent: counts.sent, totalFailed: counts.failed, sentStudentIds: [] };
    }

    // Re-read each student NOW: they may have been reactivated or deleted since the send was started.
    const inactive = new Map((await loadInactiveStudents()).map((s) => [s.id, s]));
    const vercelEnv = process.env.VERCEL_ENV;
    const items: (BatchItem & { studentId: string })[] = [];
    let failed = 0;

    for (const row of rows) {
      const student = inactive.get(row.student_id);
      const email = student ? normalizeEmail(student.email) : null;
      let reason: string | null = null;
      if (!student) reason = "No longer an inactive student.";
      else if (!email) reason = "No valid email address.";
      else if (!isRecipientAllowedHere(email, vercelEnv)) reason = "Blocked: outside the production deployment only test addresses can receive this email.";

      if (reason || !student || !email) {
        failed += 1;
        await db.from("inactive_notice_log").update({ status: "failed", error: reason }).eq("id", row.id).eq("status", "pending");
      } else {
        items.push({ rowId: row.id, studentId: row.student_id, email, fullName: student.full_name });
      }
    }

    const sentStudentIds: string[] = [];
    let sent = 0;
    let stopped: { reason: "quota" | "rate_limit" | "other"; message: string } | undefined;

    if (items.length > 0) {
      const outcome = await sendNoticeBatch(items, runId);
      if (outcome.kind === "stopped") {
        stopped = { reason: outcome.reason, message: outcome.message };
      } else {
        const now = new Date().toISOString();
        const byRow = new Map(items.map((i) => [i.rowId, i.studentId]));
        await Promise.all(
          outcome.results.map(async (result) => {
            if (result.ok) {
              sent += 1;
              sentStudentIds.push(byRow.get(result.rowId)!);
              await db
                .from("inactive_notice_log")
                .update({ status: "sent", sent_at: now, resend_email_id: result.resendId, error: null })
                .eq("id", result.rowId)
                .eq("status", "pending");
            } else {
              failed += 1;
              await db.from("inactive_notice_log").update({ status: "failed", error: result.error }).eq("id", result.rowId).eq("status", "pending");
            }
          })
        );
      }
    }

    const counts = await runCounts(runId);
    return {
      ok: true,
      sent,
      failed,
      remaining: counts.pending,
      total: counts.total,
      totalSent: counts.sent,
      totalFailed: counts.failed,
      sentStudentIds,
      stopped,
    };
  } catch (error) {
    console.error("[InactiveNotice] Chunk failed:", error);
    return { ok: false, error: "Something went wrong while sending. Anything not yet sent is still pending; you can resume." };
  }
}

/** Gives up on a stopped send: its pending rows are closed out as failed ('discarded'), so a new send can start. */
export async function discardInactiveNoticeRun(runId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId)) return { ok: false, error: "Invalid send." };

  const db = createAdminClient();
  const { error } = await db
    .from("inactive_notice_log")
    .update({ status: "failed", error: "Discarded by admin." })
    .eq("run_id", runId)
    .eq("status", "pending");
  if (error) {
    console.error("[InactiveNotice] Could not discard the send:", error);
    return { ok: false, error: "Could not discard the pending send." };
  }
  return { ok: true };
}
