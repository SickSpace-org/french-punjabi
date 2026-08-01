"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Lock, Mail, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function StudentLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordMode, setShowPasswordMode] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "suspended"
      ? "Your account has been suspended. Please contact the AngrishFrançais team."
      : searchParams.get("error") === "not_authorized"
        ? "This account isn't set up for the Student Portal yet."
        : null
  );

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const supabase = createClient();
    // shouldCreateUser: false — a student account is only ever created
    // server-side after a confirmed payment, never by typing an email
    // here. We don't reveal whether the email is registered either way,
    // to avoid leaking which emails are enrolled.
    await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/student/verify`,
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

    const { data: studentRow } = await supabase
      .from("students")
      .select("id, status")
      .eq("auth_user_id", data.user.id)
      .maybeSingle();

    if (!studentRow) {
      await supabase.auth.signOut();
      setError("This account isn't set up for the Student Portal yet. Please contact us for help.");
      setStatus("idle");
      return;
    }

    if (studentRow.status === "SUSPENDED") {
      setError("Your account has been suspended. Please contact the AngrishFrançais team.");
      setStatus("idle");
      router.push("/student");
      router.refresh();
      return;
    }

    router.push("/student");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-dim px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold tracking-tight text-navy">
            Angrish<span className="text-red">Français</span>
          </p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Student Portal
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
                If <span className="font-semibold text-navy">{email}</span> is set up for the Student
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

              {!showPasswordMode ? (
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
                        placeholder="The email you enrolled with"
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
                      setShowPasswordMode(true);
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
                      setShowPasswordMode(false);
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
