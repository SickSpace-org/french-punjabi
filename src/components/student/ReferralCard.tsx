"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Gift, Users } from "lucide-react";
import { getOrCreateOwnReferralCode } from "@/lib/payments/referralActions";
import type { ReferralSummary } from "@/lib/student/getReferralSummary";

export default function ReferralCard({ summary, siteUrl }: { summary: ReferralSummary; siteUrl: string }) {
  const [code, setCode] = useState(summary.referralCode);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    startTransition(async () => {
      const newCode = await getOrCreateOwnReferralCode();
      if (newCode) setCode(newCode);
    });
  };

  const link = code ? `${siteUrl}/test-stripe-subscription?ref=${code}` : null;

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the link is still visible to copy by hand.
    }
  };

  return (
    <div className="mt-6 max-w-lg rounded-2xl border border-navy/10 bg-white p-6">
      <p className="flex items-center gap-2 font-display text-base font-bold text-navy">
        <Gift className="h-4 w-4 text-red" strokeWidth={2} />
        Refer a Friend
      </p>
      <p className="mt-1 text-sm text-navy/60">
        They get $25 off their first payment. You get $25 off one upcoming month, once their first payment goes
        through.
      </p>

      {code ? (
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 truncate rounded-xl border border-navy/15 bg-cream-dim/60 px-4 py-2.5 text-sm font-semibold text-navy">
            {link}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-navy/15 bg-white px-3 py-2.5 text-sm font-semibold text-navy hover:bg-cream-dim"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" strokeWidth={2} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-red px-5 py-2.5 text-sm font-bold text-white hover:bg-red-dark disabled:opacity-60"
        >
          {pending ? "Generating…" : "Get My Referral Link"}
        </button>
      )}

      <div className="mt-5 flex items-center gap-6 border-t border-navy/10 pt-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-navy/40">
            <Users className="h-3 w-3" strokeWidth={2} />
            Friends Joined
          </p>
          <p className="mt-0.5 font-display text-lg font-bold text-navy">{summary.friendsJoined}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Credit Earned</p>
          <p className="mt-0.5 font-display text-lg font-bold text-navy">${(summary.creditedCount * 25).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
