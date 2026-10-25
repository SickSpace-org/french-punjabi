"use client";

import { usePathname } from "next/navigation";
import { GraduationCap } from "lucide-react";
import Link from "next/link";

/**
 * Deliberately a Client Component, not a layout-level redirect — the
 * allow-list needs the CURRENT path, which an async Server Component
 * layout has no clean way to read without middleware. is_active_student()
 * (see supabase/006_student_accounts.sql) is NOT changed for a
 * phase_completed student — they still can't read course_content,
 * attendance, etc. at the database level, by design (see 056_inactive_
 * reason.sql's own comment). This component is the matching UI-level
 * restriction: only the pages a phase_completed student actually needs
 * (pay for their next phase, see notices, reach a human) render; every
 * other page would just come back empty from RLS anyway, so blocking it
 * here first avoids a confusing "No courses assigned yet"-style empty
 * state for something they really do have an answer for ("you've
 * finished — here's how to continue").
 */
const ALLOWED_PATHS = ["/student/subscription", "/student/notifications", "/student/support"];

export default function PhaseCompletedGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const allowed = ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (allowed) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-navy/10 bg-white px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-soft text-red">
        <GraduationCap className="h-6 w-6" strokeWidth={2} />
      </span>
      <div>
        <p className="font-display text-lg font-bold text-navy">You&apos;ve Completed This Phase</p>
        <p className="mt-2 max-w-sm text-sm text-navy/60">
          Nothing is owed on it. Head to your Subscription page to pick your next phase whenever you&apos;re ready.
        </p>
      </div>
      <Link
        href="/student/subscription"
        className="inline-flex items-center justify-center rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy/90"
      >
        Go to Subscription
      </Link>
    </div>
  );
}
