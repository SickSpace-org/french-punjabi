"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing page for every invite / magic-link email — NOT behind the
 * /student auth guard (see proxy.ts's isPublicStudentPage), on purpose.
 *
 * The session token arrives in the URL fragment (#access_token=...),
 * which browsers never send to the server — so a server-guarded route
 * would see no session yet and redirect away before this page's own JS
 * ever got a chance to read it. createBrowserClient reads that fragment
 * client-side automatically and turns it into a real (cookie-backed)
 * session; once that's done we do a client-side redirect to /student,
 * which by then has a session the server can actually see.
 */
export default function StudentVerifyPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/student");
        router.refresh();
      } else {
        setFailed(true);
      }
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-dim px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <p className="font-display text-2xl font-semibold tracking-tight text-navy">
          Angrish<span className="text-red">Français</span>
        </p>

        <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-7 shadow-sm">
          {failed ? (
            <div className="flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft px-4 py-3 text-left text-sm text-red-dark">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <p>
                This link has expired or was already used. Go back to{" "}
                <a href="/student/login" className="font-semibold underline">
                  Student Login
                </a>{" "}
                and request a new one.
              </p>
            </div>
          ) : (
            <p className="text-sm text-navy/60">Signing you in…</p>
          )}
        </div>
      </div>
    </div>
  );
}
