import { createClient } from "@/lib/supabase/server";
import { getExistingStudentBilling, getExistingStudentRollout } from "@/lib/students/getExistingStudentBilling";
import BillingTable from "@/components/admin/students/BillingTable";

export const revalidate = 0;

export default async function AdminStudentsBillingPage() {
  const supabase = await createClient();

  let rows: Awaited<ReturnType<typeof getExistingStudentBilling>> | null = null;
  let rollout: Awaited<ReturnType<typeof getExistingStudentRollout>> = "off";
  try {
    [rows, rollout] = await Promise.all([getExistingStudentBilling(supabase), getExistingStudentRollout(supabase)]);
  } catch (error) {
    console.error("[Admin] Failed to load existing-student billing:", error);
  }

  if (!rows) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy">Existing-Student Billing</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-navy/60">Couldn&apos;t load billing data right now. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  const unclassifiedCount = rows.filter((r) => r.paymentMode === null).length;
  const needsReviewCount = rows.filter((r) => r.nextPaymentDueNeedsReview).length;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Existing-Student Billing</h1>
      <p className="mt-1 text-sm text-navy/60">
        Due dates and payment-mode classification for students enrolled before Stripe. Nothing is sent until the rollout below is switched on; once it is,
        enabled students get a &quot;payment due&quot; notice 7 days before their due date, and you get an email when one is 3 days past due. Nothing suspends
        or deactivates a student automatically.
      </p>
      {unclassifiedCount > 0 || needsReviewCount > 0 ? (
        <p className="mt-2 text-sm font-medium text-amber-700">
          {unclassifiedCount > 0 ? `${unclassifiedCount} unclassified` : ""}
          {unclassifiedCount > 0 && needsReviewCount > 0 ? " · " : ""}
          {needsReviewCount > 0 ? `${needsReviewCount} due date${needsReviewCount === 1 ? "" : "s"} need review` : ""}
        </p>
      ) : null}

      <div className="mt-6">
        <BillingTable rows={rows} rollout={rollout} />
      </div>
    </div>
  );
}
