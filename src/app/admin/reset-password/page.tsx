"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Reached only via a Supabase password-recovery email link — NOT behind
 * the /admin auth guard (see proxy.ts), on purpose. The recovery token
 * arrives in the URL fragment, which browsers never send to the server,
 * so it has to be picked up by this page's own client-side JS before the
 * server-side "are you logged in" check would otherwise redirect it away
 * (same reasoning as /student/verify).
 */
export default function AdminResetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setCheckingSession(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setStatus("submitting");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message || "Something went wrong. Please try again.");
      setStatus("idle");
      return;
    }

    setStatus("done");
    setTimeout(() => {
      router.push("/admin");
      router.refresh();
    }, 1200);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-dim px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold tracking-tight text-navy">
            French<span className="text-red">Punjabi</span>
          </p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Reset Admin Password
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-7 shadow-sm">
          {checkingSession ? (
            <p className="text-center text-sm text-navy/50">Verifying your reset link…</p>
          ) : !hasSession ? (
            <div className="flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft px-4 py-3 text-sm text-red-dark">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <p>This link has expired or was already used. Request a new one from the login page.</p>
            </div>
          ) : status === "done" ? (
            <p className="text-center text-sm font-semibold text-navy">
              Password updated — taking you to the dashboard…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error ? (
                <div className="flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft px-4 py-3 text-sm text-red-dark">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  <p>{error}</p>
                </div>
              ) : null}

              <div>
                <label className="text-sm font-semibold text-navy" htmlFor="password">
                  New Password
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 focus-within:border-red focus-within:ring-4 focus-within:ring-red/10">
                  <Lock className="h-4 w-4 shrink-0 text-navy/35" strokeWidth={2} />
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-sm text-navy outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-navy" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 focus-within:border-red focus-within:ring-4 focus-within:ring-red/10">
                  <Lock className="h-4 w-4 shrink-0 text-navy/35" strokeWidth={2} />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full text-sm text-navy outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 hover:bg-red-dark disabled:opacity-60"
              >
                {status === "submitting" ? "Saving…" : "Set Password & Continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
