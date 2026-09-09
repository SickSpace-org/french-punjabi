import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { ToastProvider } from "@/components/admin/ToastProvider";
import StudentShell from "@/components/student/StudentShell";
import StudentLogoutButton from "@/components/student/StudentLogoutButton";

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

  return (
    <ToastProvider>
      <StudentShell studentName={studentRow.full_name}>{children}</StudentShell>
    </ToastProvider>
  );
}
