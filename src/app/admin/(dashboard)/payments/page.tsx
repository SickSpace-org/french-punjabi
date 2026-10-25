import { AlertTriangle, CreditCard, Gift, ShieldAlert, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAdminPaymentsOverview } from "@/lib/payments/getAdminPaymentsOverview";
import { formatTimestampMediumWithTime } from "@/lib/format/date";

export const revalidate = 0;

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SUSPENDED: "border-red/20 bg-red-soft text-red-dark",
  INACTIVE: "border-navy/15 bg-navy/5 text-navy/50",
};

const EVENT_STYLES: Record<string, string> = {
  payment_succeeded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  referral_credited: "border-emerald-200 bg-emerald-50 text-emerald-700",
  access_restored: "border-emerald-200 bg-emerald-50 text-emerald-700",
  payment_failed: "border-red/20 bg-red-soft text-red-dark",
  access_suspended: "border-red/20 bg-red-soft text-red-dark",
  access_revoked: "border-red/20 bg-red-soft text-red-dark",
  charge_refunded: "border-amber-200 bg-amber-50 text-amber-700",
  charge_disputed: "border-amber-200 bg-amber-50 text-amber-700",
  reconciliation_mismatch: "border-amber-200 bg-amber-50 text-amber-700",
  referral_reversed: "border-amber-200 bg-amber-50 text-amber-700",
  autopay_set_up: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function eventLabel(eventType: string) {
  return eventType.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="flex items-center gap-2 text-navy/50">
        <Icon className="h-4 w-4" strokeWidth={2} />
        <p className="text-[11px] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-navy">{value}</p>
    </div>
  );
}

export default async function AdminPaymentsPage() {
  const supabase = await createClient();

  let overview: Awaited<ReturnType<typeof getAdminPaymentsOverview>> | null = null;
  try {
    overview = await getAdminPaymentsOverview(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load payments overview:", error);
  }

  if (!overview) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Payments</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">Couldn&apos;t load payments data right now. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  const { subscriptions, recentEvents, referrals, drift, trialingCount, everTrialedCount } = overview;
  const activeCount = subscriptions.filter((s) => s.status === "ACTIVE").length;
  const suspendedCount = subscriptions.filter((s) => s.status === "SUSPENDED").length;
  const failingCount = subscriptions.filter((s) => s.payment_failure_count > 0).length;
  const pendingReferrals = referrals.filter((r) => r.status === "pending").length;
  const earnedReferrals = referrals.filter((r) => r.status === "earned").length;
  const appliedReferrals = referrals.filter((r) => r.status === "applied").length;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Payments</h1>
      <p className="mt-1 text-sm text-navy/60">Stripe subscriptions, recent billing events, referrals, and trial usage.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Active" value={activeCount} icon={Users} />
        <StatTile label="Suspended" value={suspendedCount} icon={ShieldAlert} />
        <StatTile label="Trialing" value={trialingCount} icon={CreditCard} />
        <StatTile label="Failing Payment" value={failingCount} icon={AlertTriangle} />
        <StatTile label="Ever Trialed" value={everTrialedCount} icon={CreditCard} />
        <StatTile label="Referrals Pending/Queued" value={`${pendingReferrals}/${earnedReferrals}`} icon={Gift} />
      </div>

      {drift.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} />
            <p className="text-sm font-bold">Seat-count drift detected — recorded filled_slots doesn&apos;t match actual seat-holding students</p>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wide text-amber-700/70">
                  <th className="px-2 py-1.5">Batch</th>
                  <th className="px-2 py-1.5">Recorded</th>
                  <th className="px-2 py-1.5">Actual</th>
                  <th className="px-2 py-1.5">Drift</th>
                </tr>
              </thead>
              <tbody>
                {drift.map((d) => (
                  <tr key={d.batch_id} className="border-t border-amber-200/60">
                    <td className="px-2 py-1.5 font-semibold text-amber-900">{d.batch_label}</td>
                    <td className="px-2 py-1.5 text-amber-800">{d.recorded_filled_slots}</td>
                    <td className="px-2 py-1.5 text-amber-800">{d.actual_active_count}</td>
                    <td className="px-2 py-1.5 font-bold text-amber-900">{d.drift > 0 ? `+${d.drift}` : d.drift}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-amber-700/80">Read-only check — nothing here fixes itself automatically. A positive drift means filled_slots overcounts (seats reading as taken that shouldn&apos;t be).</p>
        </div>
      ) : null}

      <h2 className="mt-8 font-display text-lg font-bold text-navy">Subscriptions ({subscriptions.length})</h2>
      {subscriptions.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-navy/60">No Stripe subscribers yet.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Stripe Status</th>
                <th className="px-4 py-3">Locked Price</th>
                <th className="px-4 py-3">Next Payment Due</th>
                <th className="px-4 py-3">Failures</th>
                <th className="px-4 py-3">Referral Code</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-navy/5 last:border-0 hover:bg-cream-dim/60">
                  <td className="px-4 py-3">
                    <a href={`/admin/students/${s.id}`} className="font-semibold text-navy hover:text-red-dark hover:underline">
                      {s.full_name}
                    </a>
                    <p className="text-xs text-navy/50">{s.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Pill label={s.status} className={STATUS_STYLES[s.status] ?? STATUS_STYLES.INACTIVE} />
                  </td>
                  <td className="px-4 py-3 text-navy/70">{s.subscription_status ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/70">
                    {s.locked_price != null ? `${s.locked_currency ?? "CAD"} $${s.locked_price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-navy/50">
                    {s.next_payment_due_at ? formatTimestampMediumWithTime(s.next_payment_due_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.payment_failure_count > 0 ? (
                      <span className="font-bold text-red-dark">{s.payment_failure_count}</span>
                    ) : (
                      <span className="text-navy/40">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-display text-xs font-bold text-navy/60">{s.referral_code ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-display text-lg font-bold text-navy">Recent Billing Events</h2>
      {recentEvents.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-navy/60">No billing events logged yet.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((e) => (
                <tr key={e.id} className="border-b border-navy/5 last:border-0 hover:bg-cream-dim/60">
                  <td className="px-4 py-3">
                    <Pill label={eventLabel(e.event_type)} className={EVENT_STYLES[e.event_type] ?? "border-navy/15 bg-navy/5 text-navy/60"} />
                  </td>
                  <td className="px-4 py-3 text-navy/70">
                    {e.student_name ? (
                      <>
                        {e.student_name}
                        <p className="text-xs text-navy/50">{e.student_email}</p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy/70">{e.amount != null ? `${e.currency ?? "CAD"} $${e.amount.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-navy/50" title={e.note ?? ""}>
                    {e.note ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-navy/50">{formatTimestampMediumWithTime(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 font-display text-lg font-bold text-navy">
        Referrals ({pendingReferrals} pending · {earnedReferrals} queued · {appliedReferrals} applied)
      </h2>
      {referrals.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-navy/60">No referrals yet.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-navy/10 bg-white">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-[11px] font-bold uppercase tracking-wide text-navy/40">
                <th className="px-4 py-3">Referrer</th>
                <th className="px-4 py-3">Referred</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Applied</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-navy/5 last:border-0 hover:bg-cream-dim/60">
                  <td className="px-4 py-3 font-semibold text-navy">{r.referrer_name ?? "—"}</td>
                  <td className="px-4 py-3 text-navy/70">{r.referred_name ?? "— (not activated yet)"}</td>
                  <td className="px-4 py-3">
                    <Pill
                      label={r.status}
                      className={
                        r.status === "applied"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : r.status === "earned"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : r.status === "reversed"
                              ? "border-red/20 bg-red-soft text-red-dark"
                              : "border-navy/15 bg-navy/5 text-navy/50"
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-navy/50">{formatTimestampMediumWithTime(r.created_at)}</td>
                  <td className="px-4 py-3 text-navy/50">{r.applied_at ? formatTimestampMediumWithTime(r.applied_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
