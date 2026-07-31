import type { PaymentStatus } from "@/types/database";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status === "PENDING" ? "🟡 Pending" : "🟢 Paid"}
    </span>
  );
}
