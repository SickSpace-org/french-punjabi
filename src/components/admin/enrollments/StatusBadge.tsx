import type { EnrollmentStatus } from "@/types/database";

const STATUS_STYLES: Record<EnrollmentStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  CONTACTED: "bg-amber-50 text-amber-700 border-amber-200",
  ENROLLED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  NOT_INTERESTED: "bg-navy/5 text-navy/50 border-navy/15",
};

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  ENROLLED: "Enrolled",
  NOT_INTERESTED: "Not Interested",
};

export default function StatusBadge({ status }: { status: EnrollmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
