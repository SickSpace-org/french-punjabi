"use client";

import { useState } from "react";
import { CircleAlert, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/admin/ToastProvider";

/**
 * Runs entirely in the admin's own authenticated browser session via
 * supabase.auth.updateUser() — the new password is typed here and sent
 * directly to Supabase from the browser. It never passes through any
 * server action, script, or anywhere else it could be seen/logged.
 */
export default function ChangePasswordForm() {
  const { showToast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPending(false);

    if (updateError) {
      setError(updateError.message || "Something went wrong. Please try again.");
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    showToast("Password updated.");
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red/20 bg-red-soft px-4 py-3 text-sm text-red-dark">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>{error}</p>
        </div>
      ) : null}

      <div>
        <label className="text-sm font-semibold text-navy" htmlFor="new-password">
          New Password
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 focus-within:border-red focus-within:ring-4 focus-within:ring-red/10">
          <Lock className="h-4 w-4 shrink-0 text-navy/35" strokeWidth={2} />
          <input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full text-sm text-navy outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-navy" htmlFor="confirm-password">
          Confirm Password
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 focus-within:border-red focus-within:ring-4 focus-within:ring-red/10">
          <Lock className="h-4 w-4 shrink-0 text-navy/35" strokeWidth={2} />
          <input
            id="confirm-password"
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
        disabled={pending}
        className="rounded-full bg-red px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm shadow-red/30 hover:bg-red-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update Password"}
      </button>
    </form>
  );
}
