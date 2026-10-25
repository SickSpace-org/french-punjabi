"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Upload, AlertTriangle, CreditCard } from "lucide-react";
import type { ExistingStudentBillingRow } from "@/lib/students/getExistingStudentBilling";
import {
  updateNextPaymentDue,
  updatePaymentMode,
  bulkImportBilling,
  recordManualPayment,
  updateStudentLifecycleEnabled,
  updateExistingStudentRollout,
  type BulkBillingRow,
} from "@/app/admin/(dashboard)/students/billing/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { formatTimestampMedium } from "@/lib/format/date";

type PreviewRow = {
  studentId: string;
  firstName: string;
  oldDue: string | null;
  newDue: string;
  status: "apply" | "skip";
  reason: string | null;
};

const CSV_COLUMNS = [
  "student_id",
  "full_name",
  "email",
  "status",
  "payment_mode",
  "amount_due",
  "currency",
  "latest_enrollment_at",
  "suggested_due_date",
  "next_payment_due",
] as const;

/** Minimal quote-aware CSV — fields are only ever names/emails/dates/enum
 * values from our own data, but a comma or quote in a name is plausible,
 * so this still quotes+escapes properly rather than assuming it never
 * happens. */
function toCsv(rows: ExistingStudentBillingRow[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.studentId,
        r.fullName,
        r.email,
        r.status,
        r.paymentMode ?? "",
        r.amountDue?.toFixed(2) ?? "",
        r.currency ?? "",
        r.latestEnrollmentAt.slice(0, 10),
        r.suggestedFromEnrollmentAnniversary,
        r.nextPaymentDue ?? "",
      ]
        .map((v) => esc(String(v)))
        .join(",")
    );
  }
  return lines.join("\n");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DueDateCell({ row }: { row: ExistingStudentBillingRow }) {
  const { showToast } = useToast();
  const [value, setValue] = useState(row.nextPaymentDue ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await updateNextPaymentDue(row.studentId, value || null);
    setSaving(false);
    if (!result.ok) showToast(result.error, "error");
    else showToast("Due date updated.");
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value !== (row.nextPaymentDue ?? "")) void save();
        }}
        className="rounded-lg border border-navy/15 px-2 py-1 text-xs disabled:opacity-60"
      />
      {row.nextPaymentDueNeedsReview ? (
        <span title="Advancing this date landed in the past — needs manual review." className="text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      ) : null}
    </div>
  );
}

function PaymentModeCell({ row }: { row: ExistingStudentBillingRow }) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  if (row.paymentMode === "full") {
    return <span className="rounded-full border border-navy/15 bg-navy/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-navy/50">No Recurring Plan</span>;
  }

  const handleChange = async (mode: "full" | "monthly") => {
    setSaving(true);
    const result = await updatePaymentMode(row.latestEnrollmentId, mode);
    setSaving(false);
    if (!result.ok) showToast(result.error, "error");
    else showToast(`Classified as ${mode}.`);
  };

  if (row.paymentMode === "monthly") {
    return (
      <select
        defaultValue="monthly"
        disabled={saving}
        onChange={(e) => void handleChange(e.target.value as "full" | "monthly")}
        className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 disabled:opacity-60"
      >
        <option value="monthly">Monthly</option>
        <option value="full">Full</option>
      </select>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">Unclassified</span>
      <select
        disabled={saving}
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) void handleChange(e.target.value as "full" | "monthly");
        }}
        className="rounded-lg border border-navy/15 px-1.5 py-1 text-xs disabled:opacity-60"
      >
        <option value="" disabled>
          Classify…
        </option>
        <option value="monthly">Monthly</option>
        <option value="full">Full</option>
      </select>
    </div>
  );
}

function LifecycleEnabledCell({ row }: { row: ExistingStudentBillingRow }) {
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(row.existingLifecycleEnabled);
  const [saving, setSaving] = useState(false);
  const eligible = row.paymentMode === "monthly" && Boolean(row.nextPaymentDue);

  const handleChange = async (next: boolean) => {
    setSaving(true);
    const result = await updateStudentLifecycleEnabled(row.studentId, next, row.paymentMode, Boolean(row.nextPaymentDue));
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    setEnabled(next);
    showToast(next ? "Enabled for the automated lifecycle." : "Disabled.");
  };

  return (
    <label className={`inline-flex items-center gap-1.5 text-xs ${eligible ? "text-navy/70" : "text-navy/30"}`} title={eligible ? undefined : "Needs a monthly classification and a due date first."}>
      <input type="checkbox" checked={enabled} disabled={saving || !eligible} onChange={(e) => void handleChange(e.target.checked)} className="h-3.5 w-3.5" />
      Enabled
    </label>
  );
}

function RecordPaymentCell({ row }: { row: ExistingStudentBillingRow }) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState(row.amountDue != null ? String(row.amountDue) : "");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  if (row.paymentMode !== "monthly") {
    return <span className="text-xs text-navy/30">{row.paymentMode === "full" ? "—" : "Classify first"}</span>;
  }

  const handleConfirm = async () => {
    setSaving(true);
    const result = await recordManualPayment(row.studentId, Number(amount), row.currency ?? "CAD");
    setSaving(false);
    setConfirming(false);
    if (!result.ok) {
      showToast(result.reason ?? "Failed to record payment.", "error");
      return;
    }
    if (result.reactivationBlocked) {
      showToast("Payment recorded, but the batch is full — could not reactivate. Needs manual attention.", "error");
    } else if (result.needsReview) {
      showToast("Payment recorded — due date flagged for review (one cycle wasn't enough to reach the future).", "error");
    } else {
      showToast(result.reactivated ? "Payment recorded and student reactivated." : "Payment recorded.");
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-20 rounded-lg border border-navy/15 px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={saving || !amount || Number(amount) <= 0}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1 rounded-full border border-navy/15 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-navy hover:bg-cream-dim disabled:opacity-60"
        >
          <CreditCard className="h-3 w-3" strokeWidth={2} />
          Record
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Record payment for ${row.fullName.split(" ")[0]}?`}
        description={`Records ${row.currency ?? "CAD"} $${Number(amount || 0).toFixed(2)}, clears any overdue status, and advances their due date by one billing cycle${row.status !== "ACTIVE" ? ` (and attempts to restore them from ${row.status} to ACTIVE)` : ""}.`}
        confirmLabel="Record Payment"
        pending={saving}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}

function RolloutControl({ initialRollout }: { initialRollout: "off" | "per_student" | "all" }) {
  const { showToast } = useToast();
  const [rollout, setRollout] = useState(initialRollout);
  const [pendingValue, setPendingValue] = useState<"off" | "per_student" | "all" | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!pendingValue) return;
    setSaving(true);
    const result = await updateExistingStudentRollout(pendingValue);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
    } else {
      setRollout(pendingValue);
      showToast(`Rollout set to "${pendingValue}".`);
    }
    setPendingValue(null);
  };

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-navy/10 bg-white px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-navy/50">Rollout:</span>
      {(["off", "per_student", "all"] as const).map((v) => (
        <button
          key={v}
          type="button"
          disabled={saving}
          onClick={() => v !== rollout && setPendingValue(v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:opacity-60 ${
            rollout === v ? "border-red/30 bg-red-soft text-red-dark" : "border-navy/15 bg-white text-navy/60 hover:bg-cream-dim"
          }`}
        >
          {v === "off" ? "Off" : v === "per_student" ? "Per-Student" : "All"}
        </button>
      ))}
      <ConfirmDialog
        open={pendingValue !== null}
        title={`Set rollout to "${pendingValue}"?`}
        description={
          pendingValue === "off"
            ? "No existing student will be automatically reminded, suspended, or marked inactive."
            : pendingValue === "per_student"
              ? "Only students you individually enable below (with a monthly classification and a due date) will be automatically reminded, suspended, or marked inactive."
              : "EVERY eligible existing student (monthly, with a due date set) will be automatically reminded, suspended, or marked inactive — not just the ones individually enabled."
        }
        confirmLabel="Confirm"
        danger={pendingValue === "all"}
        pending={saving}
        onCancel={() => setPendingValue(null)}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}

export default function BillingTable({ rows, rollout }: { rows: ExistingStudentBillingRow[]; rollout: "off" | "per_student" | "all" }) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadCsv(toCsv(rows), `existing-student-billing-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const [preview, setPreview] = useState<PreviewRow[] | null>(null);

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        showToast("CSV has no data rows.", "error");
        return;
      }
      const header = parseCsvLine(lines[0]);
      const idIdx = header.indexOf("student_id");
      const dueIdx = header.indexOf("next_payment_due");
      if (idIdx === -1 || dueIdx === -1) {
        showToast("CSV is missing student_id or next_payment_due — export first, edit that file, re-import it.", "error");
        return;
      }

      const byId = new Map(rows.map((r) => [r.studentId, r]));
      const built: PreviewRow[] = [];
      for (const line of lines.slice(1)) {
        const cols = parseCsvLine(line);
        const studentId = cols[idIdx]?.trim();
        const row = studentId ? byId.get(studentId) : undefined;
        if (!row) continue;
        const due = cols[dueIdx]?.trim() ?? "";
        if (due === (row.nextPaymentDue ?? "")) continue; // unchanged — nothing to preview

        if (row.paymentMode !== "monthly") {
          built.push({ studentId, firstName: row.fullName.split(" ")[0], oldDue: row.nextPaymentDue, newDue: due, status: "skip", reason: row.paymentMode === "full" ? "not monthly (Full)" : "not monthly (Unclassified)" });
        } else if (due !== "" && !DATE_RE.test(due)) {
          built.push({ studentId, firstName: row.fullName.split(" ")[0], oldDue: row.nextPaymentDue, newDue: due, status: "skip", reason: `invalid date "${due}"` });
        } else if (due === "") {
          built.push({ studentId, firstName: row.fullName.split(" ")[0], oldDue: row.nextPaymentDue, newDue: due, status: "skip", reason: "blank — clearing a due date isn't supported by import" });
        } else {
          built.push({ studentId, firstName: row.fullName.split(" ")[0], oldDue: row.nextPaymentDue, newDue: due, status: "apply", reason: null });
        }
      }

      if (built.length === 0) {
        showToast("No changes found — every matching row already matches its current due date.", "error");
        return;
      }
      setPreview(built);
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!preview) return;
    const toApply: BulkBillingRow[] = preview.filter((p) => p.status === "apply").map((p) => ({ studentId: p.studentId, nextPaymentDue: p.newDue }));
    setPreview(null);
    if (toApply.length === 0) {
      showToast("Nothing to apply.", "error");
      return;
    }
    startTransition(async () => {
      const result = await bulkImportBilling(toApply);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(`Updated ${result.updated} student(s)${result.skipped.length ? `, ${result.skipped.length} failed` : ""}.`, result.skipped.length ? "error" : undefined);
      if (result.skipped.length) console.warn("Billing CSV import — rows that failed server-side:", result.skipped);
    });
  };

  return (
    <div>
      <RolloutControl initialRollout={rollout} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-navy hover:bg-cream-dim"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2} />
          Export CSV
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-navy hover:bg-cream-dim disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          {isPending ? "Importing…" : "Import CSV"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-navy/50">Export, edit next_payment_due in a spreadsheet, re-import the same file — you&apos;ll see a preview before anything is saved.</p>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl border border-navy/10 bg-white p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-navy">Confirm Import</h3>
            <p className="mt-1 text-sm text-navy/60">
              {preview.filter((p) => p.status === "apply").length} will update, {preview.filter((p) => p.status === "skip").length} will be skipped.
            </p>
            <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-navy/10">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-navy/10 text-[10px] font-bold uppercase tracking-wide text-navy/40">
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">New</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.studentId} className="border-b border-navy/5 last:border-0">
                      <td className="px-3 py-2 font-semibold text-navy">{p.firstName}</td>
                      <td className="px-3 py-2 text-navy/50">{p.oldDue ?? "—"}</td>
                      <td className="px-3 py-2 text-navy/70">{p.newDue || "—"}</td>
                      <td className="px-3 py-2">
                        {p.status === "apply" ? (
                          <span className="text-emerald-700">Will update</span>
                        ) : (
                          <span className="text-amber-700">Skip — {p.reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-navy hover:bg-cream-dim"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={preview.every((p) => p.status !== "apply")}
                onClick={confirmImport}
                className="rounded-full border border-red/30 bg-red-soft px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-dark hover:bg-red-soft/80 disabled:opacity-50"
              >
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-navy/10 bg-white">
        <table className="w-full min-w-[1400px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment Mode</th>
              <th className="px-4 py-3">Amount Due</th>
              <th className="px-4 py-3">Latest Enrollment</th>
              <th className="px-4 py-3">Next Payment Due</th>
              <th className="px-4 py-3">Rollout</th>
              <th className="px-4 py-3">Record Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.studentId} className="border-b border-navy/5 last:border-0 hover:bg-cream-dim/60">
                <td className="px-4 py-3">
                  <p className="font-semibold text-navy">{row.fullName}</p>
                  <p className="text-xs text-navy/50">{row.email}</p>
                </td>
                <td className="px-4 py-3 text-navy/70">{row.status}</td>
                <td className="px-4 py-3">
                  <PaymentModeCell row={row} />
                </td>
                <td className="px-4 py-3 text-navy/70">{row.amountDue != null ? `${row.currency ?? "CAD"} $${row.amountDue.toFixed(2)}` : "—"}</td>
                <td className="px-4 py-3 text-navy/50">{formatTimestampMedium(row.latestEnrollmentAt)}</td>
                <td className="px-4 py-3">
                  {row.paymentMode === "monthly" ? (
                    <DueDateCell row={row} />
                  ) : row.paymentMode === "full" ? (
                    <span className="text-navy/30">—</span>
                  ) : (
                    <span className="text-xs text-navy/40">Classify first</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <LifecycleEnabledCell row={row} />
                </td>
                <td className="px-4 py-3">
                  <RecordPaymentCell row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
