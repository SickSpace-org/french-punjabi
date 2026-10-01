import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getCurrentTeacher } from "@/lib/teachers/getCurrentTeacher";
import TeacherLogoutButton from "@/components/teacher/TeacherLogoutButton";
import TeacherNav from "@/components/teacher/TeacherNav";
import { ToastProvider } from "@/components/admin/ToastProvider";

/**
 * Authorization guard for every /teacher page except /teacher/login and
 * /teacher/verify. This is a UX-level guard, not the real security
 * boundary — the real enforcement is Row Level Security (is_active_teacher(),
 * current_teacher_id(), see supabase/029_teachers.sql), which independently
 * blocks any read/write from a non-active-teacher session even if this
 * check were somehow bypassed. Mirrors the student portal layout exactly.
 */
export default async function TeacherPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/teacher/login");
  }

  const teacherRow = await getCurrentTeacher(supabase);

  if (!teacherRow) {
    await supabase.auth.signOut();
    redirect("/teacher/login?error=not_authorized");
  }

  if (teacherRow.status === "DEACTIVATED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-dim px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border border-navy/10 bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-soft text-red">
            <ShieldAlert className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 font-display text-lg font-bold text-navy">Access Paused</p>
          <p className="mt-2 text-sm text-navy/60">
            Your access to the Teacher Portal has been paused. Please contact the AngrishFrançais
            team for help.
          </p>
          <div className="mt-6">
            <TeacherLogoutButton className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-cream-dim">
        <header className="flex items-center justify-between border-b border-navy/10 bg-white px-4 py-3 sm:px-8">
          <p className="font-display text-base font-semibold tracking-tight text-navy">
            Angrish<span className="text-red">Français</span>{" "}
            <span className="text-xs font-semibold uppercase tracking-wide text-navy/40">
              Teacher
            </span>
          </p>
          <TeacherLogoutButton className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-3.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim" />
        </header>
        <TeacherNav />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
