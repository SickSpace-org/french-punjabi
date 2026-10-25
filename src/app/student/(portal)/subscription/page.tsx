import { CalendarClock, CreditCard, ShieldCheck, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getSubscriptionDetails } from "@/lib/student/getSubscriptionDetails";
import { getReferralSummary } from "@/lib/student/getReferralSummary";
import { formatTimestampMedium, formatDateOnlyMedium, daysFromNow } from "@/lib/format/date";
import { getSiteUrl } from "@/lib/siteUrl";
import SubscriptionActions from "@/components/student/SubscriptionActions";
import ReferralCard from "@/components/student/ReferralCard";
import ExistingStudentPaymentOptions from "@/components/student/ExistingStudentPaymentOptions";
import PhaseReenrollment from "@/components/student/PhaseReenrollment";
import { isPhaseReenrollmentEnabled } from "@/lib/payments/phaseReenrollmentFlag";

export const revalidate = 0;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">{label}</p>
      <p className="mt-0.5 text-sm text-navy">{value}</p>
    </div>
  );
}

export default async function StudentSubscriptionPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null;

  if (!student.stripe_subscription_id) {
    const { data: eligible } = await supabase.rpc("existing_student_lifecycle_eligible", { p_student_id: student.id });
    const { data: enrollment } = eligible
      ? await supabase
          .from("enrollments")
          .select("amount_due, currency, phase_name, batch_timing")
          .eq("student_id", student.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Subscription</h1>
        {eligible && enrollment?.amount_due && student.next_payment_due ? (
          <ExistingStudentPaymentOptions
            planName={[enrollment.phase_name, enrollment.batch_timing].filter(Boolean).join(" — ")}
            amount={enrollment.amount_due}
            currency={enrollment.currency}
            nextPaymentDue={formatDateOnlyMedium(student.next_payment_due)}
            autopaySetUp={false}
          />
        ) : student.inactive_reason === "phase_completed" ? (
          <p className="mt-4 text-sm text-navy/60">
            {isPhaseReenrollmentEnabled()
              ? "You've completed your current phase — nothing is owed on it. Pick your next one below whenever you're ready."
              : "You've completed your current phase — nothing is owed on it. Get in touch with the AngrishFrançais team when you're ready for your next phase."}
          </p>
        ) : (
          <p className="mt-4 text-sm text-navy/60">
            Your payments are handled directly with the AngrishFrançais team for now. If you&apos;d like to pay online, just
            get in touch — and if online payment becomes available for your account, you&apos;ll find it here.
          </p>
        )}
        <PhaseReenrollment />
      </div>
    );
  }

  const live = await getSubscriptionDetails(student);
  const daysUntilDue = student.next_payment_due_at ? daysFromNow(student.next_payment_due_at) : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Subscription</h1>
      <p className="mt-1 text-sm text-navy/60">Your plan, billing, and payment method.</p>

      {live?.cancelAtPeriodEnd ? (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft/50 px-4 py-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-red" strokeWidth={2} />
          <p className="text-sm font-medium text-red-dark">
            Your subscription is set to cancel. Your access ends on{" "}
            {live.currentPeriodEnd ? formatTimestampMedium(live.currentPeriodEnd) : "your next billing date"}. You can
            un-cancel any time before then from the billing portal below.
          </p>
        </div>
      ) : daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3 ? (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-navy/15 bg-cream-dim/60 px-4 py-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-navy/50" strokeWidth={2} />
          <p className="text-sm font-medium text-navy">
            Your next payment is in {daysUntilDue} day{daysUntilDue === 1 ? "" : "s"}.
          </p>
        </div>
      ) : null}

      <div className="mt-6 max-w-lg rounded-2xl border border-navy/10 bg-white p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Locked-in Price"
            value={student.locked_price != null ? `${student.locked_currency ?? "CAD"} $${student.locked_price.toFixed(2)} / month` : "—"}
          />
          <Field
            label="Status"
            value={
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                {student.status}
              </span>
            }
          />
          <Field
            label={live?.cancelAtPeriodEnd ? "Access Ends" : "Next Payment"}
            value={
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                {student.next_payment_due_at ? formatTimestampMedium(student.next_payment_due_at) : "—"}
              </span>
            }
          />
          <Field label="Course Access Until" value={student.course_expiry_at ? formatTimestampMedium(student.course_expiry_at) : "—"} />
          <Field
            label="Card on File"
            value={
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-navy/40" strokeWidth={2} />
                {live?.cardBrand ? `${live.cardBrand.toUpperCase()} •••• ${live.cardLast4}` : "—"}
              </span>
            }
          />
        </div>
      </div>

      <div className="mt-6">
        <SubscriptionActions />
      </div>

      <ReferralCard summary={await getReferralSummary(supabase, student.id, student.referral_code)} siteUrl={getSiteUrl()} />

      <PhaseReenrollment />
    </div>
  );
}
