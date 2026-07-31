"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Lock, Mail } from "lucide-react";
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
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "suspended"
      ? "Your account has been suspended. Please contact the French Punjabi team."
      : searchParams.get("error") === "not_authorized"
        ? "This account isn't set up for the Student Portal yet."
        : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
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
      setError("Your account has been suspended. Please contact the French Punjabi team.");
      setStatus("idle");
      // Not signed out — the portal layout shows a clear "suspended" state
      // using this same session, matching students_self_select's design.
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
            French<span className="text-red">Punjabi</span>
          </p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-navy/50">
            Student Portal
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-navy/10 bg-white p-7 shadow-sm"
        >
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft px-4 py-3 text-sm text-red-dark">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <p>{error}</p>
            </div>
          ) : null}

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

          <p className="text-center text-xs text-navy/45">
            New here? Check your email for a portal setup link after your payment is confirmed.
          </p>
        </form>
      </div>
    </div>
  );
}
