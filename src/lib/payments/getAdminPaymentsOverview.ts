import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PaymentEventType } from "@/types/database";

export type AdminSubscriptionRow = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  subscription_status: string | null;
  locked_price: number | null;
  locked_currency: string | null;
  next_payment_due_at: string | null;
  payment_failure_count: number;
  referral_code: string | null;
};

export type AdminPaymentEventRow = {
  id: string;
  student_name: string | null;
  student_email: string | null;
  event_type: PaymentEventType;
  amount: number | null;
  currency: string | null;
  note: string | null;
  created_at: string;
};

export type AdminReferralRow = {
  id: string;
  referrer_name: string | null;
  referred_name: string | null;
  status: "pending" | "earned" | "applied" | "reversed";
  created_at: string;
  applied_at: string | null;
};

export type AdminDriftRow = {
  batch_id: string;
  batch_label: string;
  recorded_filled_slots: number;
  actual_active_count: number;
  drift: number;
};

export type AdminPaymentsOverview = {
  subscriptions: AdminSubscriptionRow[];
  recentEvents: AdminPaymentEventRow[];
  referrals: AdminReferralRow[];
  drift: AdminDriftRow[];
  trialingCount: number;
  everTrialedCount: number;
};

const RECENT_EVENTS_LIMIT = 50;
const RECENT_REFERRALS_LIMIT = 30;

/**
 * Checkpoint 2 — the admin-facing payments/subscriptions dashboard (one
 * page covering orders/status, failed payments, referrals, trial usage,
 * and the seat-count drift check). Every query here reads tables whose RLS
 * already restricts rows to is_admin() (payment_events, payment_notifications,
 * student_referrals) or is otherwise safe for any authenticated admin to
 * read — this function does no writes and runs no privileged bypass.
 *
 * Follows this codebase's established pattern (see getAdminStudents.ts) of
 * several plain queries combined with in-memory Maps rather than a
 * Postgres-level join, since `students` is read from in several places
 * with different shapes and a shared embedded-resource query would need
 * to fit all of them.
 */
export async function getAdminPaymentsOverview(supabase: SupabaseClient<Database>): Promise<AdminPaymentsOverview> {
  const [subscribedStudentsResult, eventsResult, referralsResult, driftResult, batchesResult, trialDedupeResult] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, email, status, subscription_status, locked_price, locked_currency, next_payment_due_at, payment_failure_count, referral_code")
      .not("stripe_subscription_id", "is", null)
      .order("next_payment_due_at", { ascending: true }),
    supabase
      .from("payment_events")
      .select("id, student_id, event_type, amount, currency, note, created_at")
      .order("created_at", { ascending: false })
      .limit(RECENT_EVENTS_LIMIT),
    supabase
      .from("student_referrals")
      .select("id, referrer_student_id, referred_student_id, status, created_at, applied_at")
      .order("created_at", { ascending: false })
      .limit(RECENT_REFERRALS_LIMIT),
    supabase.rpc("check_filled_slots_drift"),
    supabase.from("batches").select("id, name, time_label"),
    supabase.from("trial_dedupe_signals").select("id", { count: "exact", head: true }),
  ]);

  if (subscribedStudentsResult.error) throw subscribedStudentsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (referralsResult.error) throw referralsResult.error;
  if (driftResult.error) throw driftResult.error;
  if (batchesResult.error) throw batchesResult.error;
  if (trialDedupeResult.error) throw trialDedupeResult.error;

  const subscriptions = subscribedStudentsResult.data ?? [];

  // event/referral rows carry a student_id but not a name — one more
  // lookup across every student_id those rows mention (not just the
  // Stripe-subscribed ones already fetched above, since a payment_event
  // can reference a student who has since been fully deleted or who never
  // had a students row at all — e.g. the lost-race/waitlist path).
  const referencedStudentIds = new Set<string>();
  for (const e of eventsResult.data ?? []) if (e.student_id) referencedStudentIds.add(e.student_id);
  for (const r of referralsResult.data ?? []) {
    referencedStudentIds.add(r.referrer_student_id);
    if (r.referred_student_id) referencedStudentIds.add(r.referred_student_id);
  }

  const { data: referencedStudents } = referencedStudentIds.size
    ? await supabase.from("students").select("id, full_name, email").in("id", Array.from(referencedStudentIds))
    : { data: [] as { id: string; full_name: string; email: string }[] };

  const studentById = new Map((referencedStudents ?? []).map((s) => [s.id, s]));
  const batchById = new Map((batchesResult.data ?? []).map((b) => [b.id, b.name ?? b.time_label]));

  const recentEvents: AdminPaymentEventRow[] = (eventsResult.data ?? []).map((e) => ({
    id: e.id,
    student_name: e.student_id ? studentById.get(e.student_id)?.full_name ?? null : null,
    student_email: e.student_id ? studentById.get(e.student_id)?.email ?? null : null,
    event_type: e.event_type,
    amount: e.amount,
    currency: e.currency,
    note: e.note,
    created_at: e.created_at,
  }));

  const referrals: AdminReferralRow[] = (referralsResult.data ?? []).map((r) => ({
    id: r.id,
    referrer_name: studentById.get(r.referrer_student_id)?.full_name ?? null,
    referred_name: r.referred_student_id ? studentById.get(r.referred_student_id)?.full_name ?? null : null,
    status: r.status,
    created_at: r.created_at,
    applied_at: r.applied_at,
  }));

  const drift: AdminDriftRow[] = (driftResult.data ?? []).map((d) => ({
    batch_id: d.batch_id,
    batch_label: batchById.get(d.batch_id) ?? "(deleted batch)",
    recorded_filled_slots: d.recorded_filled_slots,
    actual_active_count: d.actual_active_count,
    drift: d.drift,
  }));

  const trialingCount = subscriptions.filter((s) => s.subscription_status === "trialing").length;

  return {
    subscriptions,
    recentEvents,
    referrals,
    drift,
    trialingCount,
    everTrialedCount: trialDedupeResult.count ?? 0,
  };
}
