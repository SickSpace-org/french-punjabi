"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Lock, Mail, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function TeacherLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

type LoginMode = "link" | "password";

/**
 * Mirrors src/app/student/login/page.tsx, minus the "sign-in code" mode —
 * there's no teacher equivalent of the code-bearing invite email (teachers
 * only ever get the permanent access link, see teacherPortalAccess* in
 * src/lib/email/templates.ts), so just email-link and the admin-set
 * password fallback.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<LoginMode>("link");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "deactivated"
      ? "Your access has been paused. Please contact the AngrishFrançais team."
      : searchParams.get("error") === "not_authorized"
        ? "This account isn't set up for the Teacher Portal yet."
        : searchParams.get("error") === "invalid_link"
          ? "That access link isn't valid. Please contact us for a new one."
          : null
  );

  const finishDirectSignIn = async (userId: string) => {
    const supabase = createClient();
    const { data: teacherRow } = await supabase
      .from("teachers")
      .select("id, status")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!teacherRow) {
      await supabase.auth.signOut();
      setError("This account isn't set up for the Teacher Portal yet. Please contact us for help.");
      setStatus("idle");
      return;
    }

    router.push("/teacher");
    router.refresh();
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const supabase = createClient();
    // shouldCreateUser: false — a teacher account is only ever created by
    // an admin adding them by email, never by typing an email here.
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/teacher/verify`,
      },
    });

    setStatus("sent");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      setError("Incorrect email or password. Please try again.");
      setStatus("idle");
      return;
    }

    await finishDirectSignIn(data.user.id);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-dim px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold tracking-tight text-navy">
            Angrish<span className="text-red">Français</span>
          </p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Teacher Portal
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-7 shadow-sm">
          {status === "sent" ? (
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-soft text-red">
                <MailCheck className="h-6 w-6" strokeWidth={2} />
              </span>
              <p className="mt-4 font-display text-base font-bold text-navy">Check your email</p>
              <p className="mt-2 text-sm text-navy/60">
                If <span className="font-semibold text-navy">{email}</span> is set up for the Teacher
                Portal, a login link has just been sent to it. Click it to get in — no password
                needed.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setEmail("");
                }}
                className="mt-6 text-sm font-semibold text-navy/60 hover:text-navy"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {error ? (
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft px-4 py-3 text-sm text-red-dark">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  <p>{error}</p>
                </div>
              ) : null}

              {mode === "link" ? (
                <form onSubmit={handleSendLink} className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-navy" htmlFor="email">
                      Email
                    </label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 focus-within:border-red focus-within:ring-4 focus-within:ring-red/10">
                      <Mail className="h-4 w-4 shrink-0 text-navy/35" strokeWidth={2} />
                      <input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your teacher email"
                        className="w-full text-sm text-navy outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 hover:bg-red-dark disabled:opacity-60"
                  >
                    {status === "submitting" ? "Sending…" : "Email Me a Login Link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("password");
                      setError(null);
                    }}
                    className="w-full text-center text-xs font-semibold text-navy/45 hover:text-navy"
                  >
                    Have a password instead? Sign in with it
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-navy" htmlFor="email2">
                      Email
                    </label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 focus-within:border-red focus-within:ring-4 focus-within:ring-red/10">
                      <Mail className="h-4 w-4 shrink-0 text-navy/35" strokeWidth={2} />
                      <input
                        id="email2"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full text-sm text-navy outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-navy" htmlFor="password">
                      Password
                    </label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 focus-within:border-red focus-within:ring-4 focus-within:ring-red/10">
                      <Lock className="h-4 w-4 shrink-0 text-navy/35" strokeWidth={2} />
                      <input
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full text-sm text-navy outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full rounded-full bg-red px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 transition-all duration-300 hover:bg-red-dark disabled:opacity-60"
                  >
                    {status === "submitting" ? "Signing In…" : "Sign In"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode("link");
                      setError(null);
                    }}
                    className="w-full text-center text-xs font-semibold text-navy/45 hover:text-navy"
                  >
                    Back to email login link
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
