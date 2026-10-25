import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldAlert, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getUnreadNotificationCount } from "@/lib/student/getNotifications";
import { getUnreadTicketReplyCount } from "@/lib/student/getSupportTickets";
import { shouldShowSubscriptionNav } from "@/lib/student/subscriptionNav";
import { ToastProvider } from "@/components/admin/ToastProvider";
import StudentShell from "@/components/student/StudentShell";
import StudentLogoutButton from "@/components/student/StudentLogoutButton";
import PaymentSuspendedScreen from "@/components/student/PaymentSuspendedScreen";
import PhaseCompletedGate from "@/components/student/PhaseCompletedGate";

/** One line to change if you want the payment-SUSPENDED screen to overlay
 * the portal instead of replacing it outright — see PaymentSuspendedScreen. */
const SUSPENDED_SCREEN_VARIANT: "fullpage" | "overlay" = "fullpage";

/**
 * Authorization guard for every /student page except /student/login and
 * /student/set-password. This is a UX-level guard, not the real security
 * boundary — the real enforcement is Row Level Security on every table
 * (students_self_select, is_active_student(), has_course_access(), see
 * supabase/006_student_accounts.sql / 007_course_content.sql), which
 * independently blocks any read/write from a non-active-student session
 * even if this check were somehow bypassed.
 */
export default async function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/student/login");
  }

  const studentRow = await getCurrentStudent(supabase);

  if (!studentRow) {
    await supabase.auth.signOut();
    redirect("/student/login?error=not_authorized");
  }

  // A SUSPENDED Stripe-subscribed student gets the payment-specific screen
  // (pay / update card); a SUSPENDED non-Stripe student (the existing
  // admin-manual-suspend path, unrelated to any payment) keeps the exact
  // original generic message — there is nothing for them to pay.
  if (studentRow.status === "SUSPENDED" && studentRow.stripe_subscription_id) {
    return (
      <Suspense>
        <PaymentSuspendedScreen variant={SUSPENDED_SCREEN_VARIANT} />
      </Suspense>
    );
  }

  if (studentRow.status === "SUSPENDED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-dim px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-navy/10 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-soft text-red">
            <ShieldAlert className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 font-display text-lg font-bold text-navy">Account Suspended</p>
          <p className="mt-2 text-sm text-navy/60">
            Your access to the Student Portal has been paused. Please contact the AngrishFrançais team
            for help.
          </p>
          <div className="mt-6">
            <StudentLogoutButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim" />
          </div>
        </div>
      </div>
    );
  }

  // A student whose phase ended cleanly (the 90-day cap reached on
  // schedule, nothing owed — see supabase/056_inactive_reason.sql) is
  // deliberately let past THIS block rather than stopped here: the whole
  // point of phase re-enrollment is that they can pick their next phase
  // themselves, from their own Subscription page, without needing to
  // contact anyone. They are NOT given the full portal, though —
  // PhaseCompletedGate below restricts them to an allow-list (subscription
  // / notifications / support), matching is_active_student() (NOT changed
  // here, on purpose — see that gate's own comment) still blocking course
  // content, attendance, etc. at the database level. Every OTHER
  // Stripe-era inactive_reason (non-payment, an explicit/early
  // cancellation, admin action) gets the "contact us" block below.
  //
  // A LEGACY inactive student — no Stripe subscription AND no
  // inactive_reason, i.e. every INACTIVE student from before Stripe —
  // is deliberately NOT stopped here: they keep exactly the behaviour
  // they had before this block existed (the normal portal shell, with
  // notifications and support reachable; row-level security still blocks
  // course data). Only a student who has a Stripe subscription on record
  // or a recorded inactive_reason is Stripe-era.
  const isStripeEraInactive =
    studentRow.status === "INACTIVE" &&
    studentRow.inactive_reason !== "phase_completed" &&
    (studentRow.stripe_subscription_id !== null || studentRow.inactive_reason !== null);
  if (isStripeEraInactive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-dim px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-navy/10 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy/10 text-navy/60">
            <Ban className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 font-display text-lg font-bold text-navy">Account Inactive</p>
          <p className="mt-2 text-sm text-navy/60">
            Your account has been made inactive. Please contact the AngrishFrançais team if you&apos;d like
            to come back.
          </p>
          <div className="mt-6">
            <StudentLogoutButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim" />
          </div>
        </div>
      </div>
    );
  }

  const [unreadCount, unreadTicketReplyCount, showSubscriptionNav] = await Promise.all([
    getUnreadNotificationCount(supabase, studentRow.id),
    getUnreadTicketReplyCount(supabase),
    shouldShowSubscriptionNav(supabase, studentRow),
  ]);

  const isPhaseCompleted = studentRow.status === "INACTIVE" && studentRow.inactive_reason === "phase_completed";

  return (
    <ToastProvider>
      <StudentShell
        studentName={studentRow.full_name}
        unreadCount={unreadCount}
        unreadTicketReplyCount={unreadTicketReplyCount}
        showSubscriptionNav={showSubscriptionNav}
      >
        {isPhaseCompleted ? <PhaseCompletedGate>{children}</PhaseCompletedGate> : children}
      </StudentShell>
    </ToastProvider>
  );
}
