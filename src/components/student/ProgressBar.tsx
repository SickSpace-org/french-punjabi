import CountUp from "@/components/CountUp";

export default function ProgressBar({
  percent,
  label,
  size = "md",
}: {
  percent: number;
  label?: string;
  size?: "sm" | "md";
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">{label}</p>
          <CountUp end={clamped} suffix="%" className="text-xs font-bold text-red-dark" duration={800} />
        </div>
      ) : null}
      <div className={`w-full overflow-hidden rounded-full bg-navy/10 ${height}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-red-dark to-red transition-all duration-700"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
