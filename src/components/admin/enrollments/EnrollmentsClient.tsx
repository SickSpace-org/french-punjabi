"use client";

import { useMemo, useState } from "react";
import { Mail, Search, Users } from "lucide-react";
import type { EnrollmentRow, EnrollmentStatus } from "@/types/database";
import type { EnrollmentCounts } from "@/lib/courses/getAdminEnrollments";
import { sendPaymentReminderBulk } from "@/app/admin/(dashboard)/enrollments/actions";
import { useToast } from "@/components/admin/ToastProvider";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import StatusBadge from "./StatusBadge";
import PaymentBadge from "./PaymentBadge";
import EnrollmentDetailModal from "./EnrollmentDetailModal";

const STATUS_FILTERS: { value: EnrollmentStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const selectClasses =
  "rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10";

export default function EnrollmentsClient({
  initialEnrollments,
  initialCounts,
}: {
  initialEnrollments: EnrollmentRow[];
  initialCounts: EnrollmentCounts;
}) {
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [counts, setCounts] = useState(initialCounts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | "all">("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [selected, setSelected] = useState<EnrollmentRow | null>(null);
  const [showBulkReminder, setShowBulkReminder] = useState(false);
  const [sendingBulkReminder, setSendingBulkReminder] = useState(false);
  const { showToast } = useToast();

  const pendingCount = useMemo(
    () => enrollments.filter((e) => e.payment_status === "PENDING").length,
    [enrollments]
  );

  const phaseOptions = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.phase_name))).sort(),
    [enrollments]
  );
  const levelOptions = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.level_name).filter((v): v is string => !!v))).sort(),
    [enrollments]
  );
  const batchOptions = useMemo(
    () => Array.from(new Set(enrollments.map((e) => e.batch_timing))).sort(),
    [enrollments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrollments.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (phaseFilter !== "all" && e.phase_name !== phaseFilter) return false;
      if (levelFilter !== "all" && e.level_name !== levelFilter) return false;
      if (batchFilter !== "all" && e.batch_timing !== batchFilter) return false;
      if (!q) return true;
      return (
        e.full_name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        e.enrollment_ref.toLowerCase().includes(q)
      );
    });
  }, [enrollments, search, statusFilter, phaseFilter, levelFilter, batchFilter]);

  const handleStatusChanged = (id: string, status: EnrollmentStatus) => {
    setEnrollments((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, status } : e));
      setCounts({
        total: next.length,
        new: next.filter((e) => e.status === "NEW").length,
        contacted: next.filter((e) => e.status === "CONTACTED").length,
        enrolled: next.filter((e) => e.status === "ENROLLED").length,
      });
      return next;
    });
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
  };

  const handlePaymentConfirmed = (id: string, paidAt: string) => {
    setEnrollments((prev) => {
      const next = prev.map((e) =>
        e.id === id
          ? { ...e, payment_status: "PAID" as const, status: "ENROLLED" as const, paid_at: paidAt }
          : e
      );
      setCounts({
        total: next.length,
        new: next.filter((e) => e.status === "NEW").length,
        contacted: next.filter((e) => e.status === "CONTACTED").length,
        enrolled: next.filter((e) => e.status === "ENROLLED").length,
      });
      return next;
    });
    setSelected((prev) =>
      prev && prev.id === id
        ? { ...prev, payment_status: "PAID", status: "ENROLLED", paid_at: paidAt }
        : prev
    );
  };

  const handleSendBulkReminder = async () => {
    setSendingBulkReminder(true);
    const result = await sendPaymentReminderBulk();
    setSendingBulkReminder(false);
    setShowBulkReminder(false);
    if (result.ok) {
      showToast(
        result.total === 0
          ? "No pending payments to remind."
          : `Sent ${result.sent} of ${result.total} reminder email${result.total === 1 ? "" : "s"}.` +
              (result.failed > 0 ? ` ${result.failed} failed.` : "")
      );
    } else {
      showToast(result.error || "Failed to send reminder emails.", "error");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Enrollments</h1>
          <p className="mt-1 text-sm text-navy/60">
            Student enrollment applications. The team follows up manually — no online payment.
          </p>
        </div>
        {pendingCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowBulkReminder(true)}
            className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-navy/70 transition-colors hover:border-red/30 hover:text-red"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={2} />
            Send Reminder to All Pending ({pendingCount})
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Enrollments", value: counts.total },
          { label: "New", value: counts.new },
          { label: "Contacted", value: counts.contacted },
          { label: "Enrolled", value: counts.enrolled },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-navy/10 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-navy">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone"
            className="w-full rounded-xl border border-navy/15 bg-white py-2.5 pl-10 pr-4 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EnrollmentStatus | "all")}
          className={selectClasses}
        >
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)} className={selectClasses}>
          <option value="all">All Phases</option>
          {phaseOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className={selectClasses}>
          <option value="all">All Levels</option>
          {levelOptions.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className={selectClasses}>
          <option value="all">All Batches</option>
          {batchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <Users className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">
            {enrollments.length === 0
              ? "No enrollment applications yet."
              : "No enrollments match your search/filters."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Enrollment ID</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Phase / Level</th>
                <th className="px-4 py-3">Batch Timing</th>
                <th className="px-4 py-3">Amount Due</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Enrollment</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((enrollment) => (
                <tr
                  key={enrollment.id}
                  onClick={() => setSelected(enrollment)}
                  className="cursor-pointer border-b border-navy/5 transition-colors last:border-0 hover:bg-cream-dim/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{enrollment.full_name}</p>
                    <p className="text-xs text-navy/50">{enrollment.email}</p>
                  </td>
                  <td className="px-4 py-3 font-display text-xs font-bold text-navy/70">
                    {enrollment.enrollment_ref}
                  </td>
                  <td className="px-4 py-3 text-navy/70">{enrollment.phone}</td>
                  <td className="px-4 py-3 text-navy/70">{enrollment.country}</td>
                  <td className="px-4 py-3 text-navy/70">
                    {enrollment.phase_name}
                    {enrollment.level_name ? ` — ${enrollment.level_name}` : ""}
                  </td>
                  <td className="px-4 py-3 text-navy/70">{enrollment.batch_timing}</td>
                  <td className="px-4 py-3 text-navy/70">
                    C${Number(enrollment.amount_due).toFixed(2)} {enrollment.currency}
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge status={enrollment.payment_status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={enrollment.status} />
                  </td>
                  <td className="px-4 py-3 text-navy/50">{formatDate(enrollment.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <EnrollmentDetailModal
          enrollment={selected}
          onClose={() => setSelected(null)}
          onStatusChanged={handleStatusChanged}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      ) : null}

      <ConfirmDialog
        open={showBulkReminder}
        title="Send Payment Reminders"
        description={`Send a payment reminder email to all ${pendingCount} enrollment${pendingCount === 1 ? "" : "s"} with payment still pending?`}
        confirmLabel="Yes, Send Reminders"
        pending={sendingBulkReminder}
        onCancel={() => setShowBulkReminder(false)}
        onConfirm={handleSendBulkReminder}
      />
    </div>
  );
}
