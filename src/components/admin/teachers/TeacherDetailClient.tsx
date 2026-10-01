"use client";

import { useState, useTransition } from "react";
import { FilePlus, FileX, Mail, MessageCircle, Pencil, Save, Send, ShieldAlert, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import type { TeacherDetail } from "@/lib/teachers/getTeacherDetail";
import {
  addTeacherPayment,
  deactivateTeacher,
  deleteTeacherHours,
  deleteTeacherPayment,
  reactivateTeacher,
  removeTeacher,
  resendTeacherInvite,
  setTeacherHours,
  setTeacherPassword,
} from "@/app/admin/(dashboard)/teachers/actions";
import { assignBatchTeacher } from "@/app/admin/(dashboard)/courses/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DEACTIVATED: "border-navy/15 bg-navy/5 text-navy/50",
};

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function PaymentsSection({ teacherId, payments }: { teacherId: string; payments: TeacherDetail["payments"] }) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) return;

    startTransition(async () => {
      const result = await addTeacherPayment(teacherId, { amount: amountNum, currency, paidAt, note });
      if (result.ok) {
        setAmount("");
        setNote("");
        showToast("Payment recorded.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  const handleDelete = (paymentId: string) => {
    startTransition(async () => {
      const result = await deleteTeacherPayment(paymentId, teacherId);
      if (!result.ok) showToast(result.error, "error");
    });
  };

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Payments</p>
      <p className="mt-0.5 text-xs text-navy/45">
        Admin-only bookkeeping — never visible to this teacher, in the portal or via any direct query.
      </p>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-28">
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Amount</label>
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <div className="w-24">
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Currency</label>
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Paid On</label>
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="mt-1 rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={2} />
          Record
        </button>
      </form>

      {payments.length === 0 ? (
        <p className="mt-4 text-sm text-navy/50">No payments recorded yet.</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-semibold text-navy/60">
            Total: {total.toFixed(2)} {payments[0]?.currency ?? "CAD"}
          </p>
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-navy/10 px-3 py-2 text-sm">
              <div>
                <span className="font-semibold text-navy">
                  {Number(p.amount).toFixed(2)} {p.currency}
                </span>
                <span className="ml-2 text-navy/45">{formatDate(p.paid_at)}</span>
                {p.note ? <span className="ml-2 text-navy/45">— {p.note}</span> : null}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleDelete(p.id)}
                aria-label="Delete payment"
                className="rounded-full p-1 text-navy/40 hover:text-red disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HoursSection({ teacherId, hours }: { teacherId: string; hours: TeacherDetail["hours"] }) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [weekStart, setWeekStart] = useState(new Date().toISOString().slice(0, 10));
  const [hoursValue, setHoursValue] = useState("");
  const [note, setNote] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = Number(hoursValue);
    if (!hoursNum || hoursNum <= 0) return;

    startTransition(async () => {
      const result = await setTeacherHours(teacherId, { weekStart, hours: hoursNum, note });
      if (result.ok) {
        setHoursValue("");
        setNote("");
        showToast("Hours saved.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  const handleDelete = (hoursId: string) => {
    startTransition(async () => {
      const result = await deleteTeacherHours(hoursId, teacherId);
      if (!result.ok) showToast(result.error, "error");
    });
  };

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Hours Taught (per week)</p>
      <p className="mt-0.5 text-xs text-navy/45">
        Admin-only bookkeeping — same visibility rule as Payments above. Re-entering a week overwrites it.
      </p>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Week Of</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="mt-1 rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <div className="w-24">
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Hours</label>
          <input
            type="number"
            min={0}
            step="0.5"
            required
            value={hoursValue}
            onChange={(e) => setHoursValue(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={2} />
          Save
        </button>
      </form>

      {hours.length === 0 ? (
        <p className="mt-4 text-sm text-navy/50">No hours recorded yet.</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {hours.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-navy/10 px-3 py-2 text-sm">
              <div>
                <span className="font-semibold text-navy">Week of {formatDate(h.week_start)}</span>
                <span className="ml-2 text-navy/45">{Number(h.hours).toFixed(1)} hrs</span>
                {h.note ? <span className="ml-2 text-navy/45">— {h.note}</span> : null}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleDelete(h.id)}
                aria-label="Delete hours entry"
                className="rounded-full p-1 text-navy/40 hover:text-red disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mirrors the password view/save UI on StudentDetailClient's Portal Access card — same fields, same 6-char minimum, same "unsaved changes" hint. No emailed "send to teacher" button: unlike students, there's no sign-in-code login mode for teachers to receive one through (see /teacher/login), so resending credentials goes through the portal-access link (Resend Invite) instead. */
function PasswordSection({ teacherId, initialPassword }: { teacherId: string; initialPassword: string | null }) {
  const { showToast } = useToast();
  const [passwordInput, setPasswordInput] = useState(initialPassword ?? "");
  const [passwordSaved, setPasswordSaved] = useState(initialPassword != null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await setTeacherPassword(teacherId, passwordInput);
    setSaving(false);
    if (result.ok) {
      setPasswordSaved(true);
      showToast("Password saved.");
    } else {
      showToast(result.error, "error");
    }
  };

  return (
    <div className="mt-4 border-t border-navy/10 pt-4">
      <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Portal Password</label>
      <p className="mt-0.5 text-xs text-navy/45">
        A permanent password you set and can view/edit anytime — used as a fallback alongside login
        links (choose &ldquo;Have a password instead?&rdquo; on the Teacher Login page).
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={passwordInput}
          onChange={(e) => {
            setPasswordInput(e.target.value);
            setPasswordSaved(false);
          }}
          placeholder="Set a password"
          className="min-w-0 flex-1 rounded-xl border border-navy/15 bg-white px-3.5 py-2 font-mono text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
        <button
          type="button"
          disabled={saving || passwordInput.length < 6}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={2} />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {!passwordSaved && passwordInput.length > 0 ? (
        <p className="mt-1.5 text-[11px] text-amber-700">Unsaved changes — click Save first.</p>
      ) : null}
    </div>
  );
}

function AssignBatchPicker({
  teacherId,
  unassignedBatches,
}: {
  teacherId: string;
  unassignedBatches: TeacherDetail["unassignedBatches"];
}) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  if (unassignedBatches.length === 0) return null;

  const handleAssign = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await assignBatchTeacher(selected, teacherId);
      if (result.ok) {
        setSelected("");
        showToast("Batch assigned.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="min-w-0 flex-1 rounded-xl border border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
      >
        <option value="">Assign an unassigned batch…</option>
        {unassignedBatches.map((b) => (
          <option key={b.batchId} value={b.batchId}>
            {b.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected || pending}
        onClick={handleAssign}
        className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
        Assign
      </button>
    </div>
  );
}

const CONTENT_ACTION_ICONS: Record<string, typeof FilePlus> = {
  created: FilePlus,
  updated: Pencil,
  deleted: FileX,
};
const CONTENT_ACTION_LABELS: Record<string, string> = {
  created: "Added",
  updated: "Edited",
  deleted: "Deleted",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Read-only, permanent record — see supabase/034_teacher_recordings.sql.
 * Nothing here is ever edited or removed by this admin UI; it only ever
 * displays what teacher_content_audit already holds.
 */
function ContentActivitySection({ entries }: { entries: TeacherDetail["contentAudit"] }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Content Activity</p>
      <p className="mt-0.5 text-xs text-navy/45">
        Every recording/material/feedback note this teacher added, edited, or deleted, and every message they
        sent, across all their batches — a permanent record that survives even after the item itself is removed.
        A student&apos;s reply to a feedback note is never included here — only the teacher&apos;s own note is.
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-navy/50">No activity yet.</p>
      ) : (
        <div className="mt-4 space-y-1.5">
          {entries.map((entry) => {
            const Icon =
              entry.content_type === "message" || entry.content_type === "feedback_note"
                ? entry.content_type === "message"
                  ? Send
                  : MessageCircle
                : CONTENT_ACTION_ICONS[entry.action] ?? FilePlus;
            return (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 rounded-lg border border-navy/10 px-3 py-2 text-sm"
              >
                <Icon
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${entry.action === "deleted" ? "text-red" : "text-navy/40"}`}
                  strokeWidth={2}
                />
                <div className="min-w-0">
                  {entry.content_type === "message" ? (
                    <>
                      <p className="text-navy">
                        <span className="font-semibold">Sent a message</span> — {entry.title || "(recipient unknown)"}
                      </p>
                      <p className="mt-0.5 text-navy/70">{entry.body}</p>
                    </>
                  ) : entry.content_type === "feedback_note" ? (
                    <>
                      <p className="text-navy">
                        <span className="font-semibold">{CONTENT_ACTION_LABELS[entry.action] ?? entry.action}</span>{" "}
                        a feedback note — {entry.title || "(student unknown)"}
                      </p>
                      <p className="mt-0.5 text-navy/70">{entry.body}</p>
                    </>
                  ) : (
                    <p className="text-navy">
                      <span className="font-semibold">{CONTENT_ACTION_LABELS[entry.action] ?? entry.action}</span>{" "}
                      a {entry.content_type} — {entry.title || entry.url || "(untitled)"}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-navy/45">
                    {entry.batchLabel} · {formatDateTime(entry.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TeacherDetailClient({ initialTeacher }: { initialTeacher: TeacherDetail }) {
  const { showToast } = useToast();
  const [teacher, setTeacher] = useState(initialTeacher);
  const [pending, startTransition] = useTransition();
  const [resendPending, setResendPending] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleToggleStatus = () => {
    startTransition(async () => {
      const result =
        teacher.status === "ACTIVE" ? await deactivateTeacher(teacher.id) : await reactivateTeacher(teacher.id);
      if (result.ok) {
        setTeacher((prev) => ({ ...prev, status: prev.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE" }));
      } else {
        showToast(result.error, "error");
      }
    });
  };

  const handleResendInvite = async () => {
    setResendPending(true);
    const result = await resendTeacherInvite(teacher.id);
    setResendPending(false);
    showToast(
      result.ok
        ? result.mode === "created"
          ? "Login credentials emailed."
          : "This email already had an account — linked it instead (no new email was sent)."
        : result.error,
      result.ok ? "success" : "error"
    );
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeTeacher(teacher.id);
      // On success this action redirect()s server-side — we only ever get
      // here on failure (redirect throws internally and never returns).
      if (!result?.ok) {
        setConfirmRemove(false);
        showToast(result?.error ?? "Unable to remove this teacher. Please try again.", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-navy/10 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Assigned Batches</p>
            {teacher.assignedBatches.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {teacher.assignedBatches.map((b) => (
                  <li key={b.batchId} className="text-sm text-navy">
                    {b.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-navy/50">
                {teacher.unassignedBatches.length > 0
                  ? "None yet — assign one below, or from the Courses page."
                  : "None yet — assign one from the Courses page."}
              </p>
            )}
            <AssignBatchPicker teacherId={teacher.id} unassignedBatches={teacher.unassignedBatches} />
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                STATUS_STYLES[teacher.status] ?? STATUS_STYLES.DEACTIVATED
              }`}
            >
              {teacher.status}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={handleToggleStatus}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide disabled:opacity-60 ${
                teacher.status === "ACTIVE"
                  ? "border-red/20 bg-white text-red hover:bg-red-soft"
                  : "border-navy/15 bg-white text-navy hover:bg-cream-dim"
              }`}
            >
              {teacher.status === "ACTIVE" ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                  Deactivate
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Reactivate
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy/10 bg-cream-dim/50 px-4 py-2.5">
          <p className="inline-flex items-center gap-1.5 text-sm text-navy">
            <Mail className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
            {teacher.auth_user_id ? "Portal login active" : "Not yet invited"}
          </p>
          <button
            type="button"
            disabled={resendPending}
            onClick={handleResendInvite}
            className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            {resendPending ? "Sending…" : teacher.auth_user_id ? "Resend Invite" : "Send Invite"}
          </button>
        </div>

        {teacher.auth_user_id ? (
          <PasswordSection teacherId={teacher.id} initialPassword={teacher.portalPassword} />
        ) : null}
      </div>

      <PaymentsSection teacherId={teacher.id} payments={teacher.payments} />
      <HoursSection teacherId={teacher.id} hours={teacher.hours} />
      <ContentActivitySection entries={teacher.contentAudit} />

      <div className="rounded-2xl border border-red/20 bg-red-soft/30 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Danger Zone</p>
        <p className="mt-1 text-sm text-navy/60">
          Permanently deletes this teacher&apos;s account and portal login. Their batch becomes
          unassigned again; payments, hours, and attendance history they&apos;re tied to are kept.
        </p>
        <button
          type="button"
          onClick={() => setConfirmRemove(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-red/30 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-red hover:bg-red-soft"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          Remove Teacher
        </button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Permanently remove this teacher?"
        description={`This deletes ${teacher.full_name}'s portal login entirely. This cannot be undone — payments, hours, and attendance history are kept, but the account itself is gone.`}
        confirmLabel="Remove Permanently"
        danger
        pending={pending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={handleRemove}
      />
    </div>
  );
}
