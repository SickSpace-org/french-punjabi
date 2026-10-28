"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import {
  discardInactiveNoticeRun,
  planInactiveNotice,
  sendInactiveNoticeChunk,
  sendInactiveNoticePreview,
  startInactiveNotice,
  type NoticePlan,
} from "@/app/admin/(dashboard)/students/inactive/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/ToastProvider";

type Problem = { code: string; message: string };
type Progress = { runId: string; total: number; sent: number; failed: number };
type DryRunSummary = Extract<NoticePlan, { ok: true }>;

const PAUSE_BETWEEN_CHUNKS_MS = 700;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function describeSkipped(plan: DryRunSummary): string {
  const parts: string[] = [];
  if (plan.skipped.recentlyEmailed) parts.push(`${plan.skipped.recentlyEmailed} emailed in the last 30 days`);
  if (plan.skipped.noEmail) parts.push(`${plan.skipped.noEmail} with no email`);
  if (plan.skipped.invalidEmail) parts.push(`${plan.skipped.invalidEmail} with an invalid email`);
  if (plan.skipped.duplicate) parts.push(`${plan.skipped.duplicate} duplicate address`);
  if (plan.skipped.notInactive) parts.push(`${plan.skipped.notInactive} no longer inactive`);
  return parts.join(", ");
}

/**
 * The one button for emailing the students currently shown (after the page's filters). The browser sends only the ids of those
 * students; the server re-checks admin, re-reads the INACTIVE list and takes every address from the database.
 */
export default function InactiveNoticeBar({
  studentIds,
  logReady,
  pendingRun,
  onEmailed,
}: {
  /** The students shown right now, after search / phase / level / batch filters. */
  studentIds: string[];
  /** False while migration 062 is not applied: sending is switched off, the rest of the page works. */
  logReady: boolean;
  pendingRun: { runId: string; pending: number; total: number } | null;
  onEmailed: (studentIds: string[]) => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [plan, setPlan] = useState<DryRunSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [stoppedMessage, setStoppedMessage] = useState<string | null>(null);
  const [resumable, setResumable] = useState<{ runId: string; pending: number } | null>(
    pendingRun ? { runId: pendingRun.runId, pending: pendingRun.pending } : null
  );
  const [dryRunResult, setDryRunResult] = useState<DryRunSummary | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const count = studentIds.length;

  const resetMessages = () => {
    setProblems([]);
    setStoppedMessage(null);
    setLastResult(null);
    setDryRunResult(null);
  };

  const runChunks = async (runId: string, startedTotal: number, alreadySent = 0, alreadyFailed = 0) => {
    setBusy(true);
    setResumable(null);
    setProgress({ runId, total: startedTotal, sent: alreadySent, failed: alreadyFailed });
    let idleRounds = 0;
    try {
      for (;;) {
        const result = await sendInactiveNoticeChunk(runId);
        if (!result.ok) {
          if (result.problems) setProblems(result.problems);
          setStoppedMessage(result.error);
          setResumable({ runId, pending: -1 });
          return;
        }
        setProgress({ runId, total: result.total, sent: result.totalSent, failed: result.totalFailed });
        if (result.sentStudentIds.length > 0) onEmailed(result.sentStudentIds);

        if (result.stopped) {
          setStoppedMessage(result.stopped.message);
          setResumable({ runId, pending: result.remaining });
          return;
        }
        if (result.remaining === 0) {
          setLastResult(
            `Finished: ${result.totalSent} sent${result.totalFailed ? `, ${result.totalFailed} failed (see the send log)` : ""}.`
          );
          showToast(`Email sent to ${result.totalSent} students.`);
          return;
        }
        idleRounds = result.sent + result.failed === 0 ? idleRounds + 1 : 0;
        if (idleRounds >= 2) {
          setStoppedMessage("Sending made no progress, so it was stopped. The rest are still pending.");
          setResumable({ runId, pending: result.remaining });
          return;
        }
        await sleep(PAUSE_BETWEEN_CHUNKS_MS);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailClick = async () => {
    if (busy || count === 0) return;
    resetMessages();
    setBusy(true);
    const result = await planInactiveNotice(studentIds);
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setProblems(result.problems);
    if (result.problems.length > 0) return;
    if (result.willSend === 0) {
      const why = describeSkipped(result);
      setLastResult(
        `Nobody to email${why ? `: ${why}` : ""}.${
          result.blockedOutsideProduction ? ` ${result.blockedOutsideProduction} held back because this is not the production site.` : ""
        }`
      );
      return;
    }
    setPlan(result);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setBusy(true);
    const started = await startInactiveNotice(studentIds);
    if (!started.ok) {
      setBusy(false);
      if (started.problems) setProblems(started.problems);
      showToast(started.error, "error");
      return;
    }
    await runChunks(started.runId, started.total);
  };

  const handlePreview = async () => {
    if (busy) return;
    resetMessages();
    setBusy(true);
    const result = await sendInactiveNoticePreview(studentIds[0]);
    setBusy(false);
    if (result.ok) {
      showToast(`Preview sent to ${result.to}.`);
    } else {
      if (result.problems) setProblems(result.problems);
      showToast(result.error, "error");
    }
  };

  const handleDryRun = async () => {
    if (busy || count === 0) return;
    resetMessages();
    setBusy(true);
    const result = await planInactiveNotice(studentIds, { dryRun: true });
    setBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setProblems(result.problems);
    setDryRunResult(result);
  };

  const handleResume = async () => {
    if (!resumable || busy) return;
    resetMessages();
    await runChunks(resumable.runId, progress?.total ?? pendingRun?.total ?? 0, progress?.sent ?? 0, progress?.failed ?? 0);
  };

  const handleDiscard = async () => {
    if (!resumable || busy) return;
    setBusy(true);
    const result = await discardInactiveNoticeRun(resumable.runId);
    setBusy(false);
    if (result.ok) {
      setResumable(null);
      setStoppedMessage(null);
      setProgress(null);
      showToast("The unsent emails were discarded.");
    } else {
      showToast(result.error, "error");
    }
  };

  const percent = progress && progress.total > 0 ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0;
  const buttonBase =
    "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleEmailClick}
          disabled={busy || count === 0 || !logReady}
          className={`${buttonBase} bg-red text-white hover:bg-red-dark`}
        >
          <Mail className="h-4 w-4" strokeWidth={2.25} />
          {busy && progress ? "Sending…" : `Email ${count} ${count === 1 ? "student" : "students"}`}
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={busy || count === 0}
          className={`${buttonBase} border border-navy/15 bg-white text-navy hover:bg-cream-dim`}
        >
          <Send className="h-4 w-4" strokeWidth={2.25} />
          Send me a preview
        </button>
        <button
          type="button"
          onClick={handleDryRun}
          disabled={busy || count === 0}
          className={`${buttonBase} border border-navy/15 bg-white text-navy/70 hover:bg-cream-dim`}
        >
          Dry run (sends nothing)
        </button>
      </div>

      <p className="mt-2 text-xs text-navy/50">
        Sends one fixed email to the {count} {count === 1 ? "student" : "students"} shown after the filters above. Anyone emailed in the last 30
        days is skipped.
      </p>

      {!logReady ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Setup needed: the send log table does not exist yet (migration 062 has not been applied), so sending is switched off. The preview and
          dry run still work.
        </p>
      ) : null}

      {problems.length > 0 ? (
        <div className="mt-3 rounded-xl border border-red/30 bg-red-soft px-3 py-2 text-sm text-red-dark">
          <p className="font-bold">Not sent. Fix this first:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {problems.map((p) => (
              <li key={p.code}>{p.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {progress && (busy || stoppedMessage || lastResult) ? (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-navy/10">
            <div className="h-full rounded-full bg-red transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-xs text-navy/60">
            {progress.sent} sent{progress.failed ? `, ${progress.failed} failed` : ""} of {progress.total}
          </p>
        </div>
      ) : null}

      {stoppedMessage ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-bold">Sending stopped.</p>
          <p className="mt-1">{stoppedMessage}</p>
        </div>
      ) : null}

      {resumable && !busy ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-navy/10 bg-cream-dim px-3 py-2 text-sm text-navy">
          <span>
            {resumable.pending >= 0 ? `${resumable.pending} emails are still pending from an earlier send.` : "Some emails are still pending from an earlier send."}
          </span>
          <button type="button" onClick={handleResume} className="rounded-full bg-navy px-4 py-1.5 text-xs font-bold text-white hover:bg-navy/90">
            Resume sending
          </button>
          <button type="button" onClick={handleDiscard} className="rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-bold text-navy hover:bg-cream-dim">
            Discard the rest
          </button>
        </div>
      ) : null}

      {lastResult ? <p className="mt-3 text-sm font-medium text-navy">{lastResult}</p> : null}

      {dryRunResult?.dryRun ? (
        <div className="mt-3 rounded-xl border border-navy/10 bg-cream-dim px-3 py-3 text-sm text-navy">
          <p className="font-bold">Dry run: nothing was sent and nothing was logged.</p>
          <p className="mt-1">
            Would email {dryRunResult.willSend} {dryRunResult.willSend === 1 ? "student" : "students"}; {dryRunResult.dryRun.rendered} rendered
            cleanly{dryRunResult.dryRun.renderFailures ? `, ${dryRunResult.dryRun.renderFailures} failed to render` : ""}.
            {describeSkipped(dryRunResult) ? ` Skipped: ${describeSkipped(dryRunResult)}.` : ""}
            {dryRunResult.blockedOutsideProduction
              ? ` ${dryRunResult.blockedOutsideProduction} would be held back because this is not the production site (only test addresses can receive it here).`
              : ""}
          </p>
          {dryRunResult.dryRun.sample ? (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-navy/80">
              {`To: ${dryRunResult.dryRun.sample.to}\nSubject: ${dryRunResult.dryRun.sample.subject}\n\n${dryRunResult.dryRun.sample.text}`}
            </pre>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={`Send this email to ${plan?.willSend ?? 0} ${plan?.willSend === 1 ? "student" : "students"}?`}
        description={
          plan
            ? `This sends the email to ${plan.willSend} inactive ${plan.willSend === 1 ? "student" : "students"} and cannot be undone. ${
                describeSkipped(plan) ? `Skipped: ${describeSkipped(plan)}. ` : ""
              }${
                plan.blockedOutsideProduction
                  ? `${plan.blockedOutsideProduction} more are held back because this is not the production site. `
                  : ""
              }Tip: use “Send me a preview” first.`
            : ""
        }
        confirmLabel={`Send to ${plan?.willSend ?? 0}`}
        danger
        pending={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
