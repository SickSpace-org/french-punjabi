import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/server";
import SubscriptionTestForm, { type TestBatchOption } from "./SubscriptionTestForm";

type BatchListRow = {
  id: string;
  name: string | null;
  time_label: string;
  timezone: string;
  availability_status: string;
  total_slots: number | null;
  filled_slots: number;
  held_slots: number;
  phases: { title: string } | null;
  levels: { name: string; phases: { title: string } | null } | null;
};

/**
 * Stage 1 test-only page — intentionally not linked from any nav. Exists
 * so you can click through the real Stripe Checkout flow with test cards
 * without touching the live public EnrollModal. See the Stage 1 build
 * notes for the manual test steps.
 */
export default async function TestStripeSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // The real public Enroll-page Stripe flow now exists (behind
  // NEXT_PUBLIC_STRIPE_ENROLL_ENABLED) — this test-only harness has no
  // reason to stay reachable in a production deployment, flag state
  // notwithstanding. Local dev and preview builds are unaffected.
  if (process.env.VERCEL === "1") {
    notFound();
  }

  const { ref } = await searchParams;
  const supabase = createPublicClient();

  const { data: batchData } = await supabase
    .from("batches")
    .select(
      "id, name, time_label, timezone, availability_status, total_slots, filled_slots, held_slots, phases ( title ), levels ( name, phases ( title ) )"
    )
    .eq("is_active", true)
    .order("display_order");

  const batches: TestBatchOption[] = ((batchData as unknown as BatchListRow[]) ?? [])
    .map((b) => {
      const phaseTitle = b.phases?.title ?? b.levels?.phases?.title ?? "Unknown Phase";
      const label = `${phaseTitle}${b.levels?.name ? ` — ${b.levels.name}` : ""} — ${b.name ? `${b.name} — ` : ""}${b.time_label} ${b.timezone}`;
      const seatsLeft = b.total_slots != null ? b.total_slots - b.filled_slots - b.held_slots : null;
      return {
        id: b.id,
        label,
        disabled: b.availability_status === "full" || b.availability_status === "hidden" || seatsLeft === 0,
        seatsLeft,
      };
    })
    .filter((b) => b.disabled !== true || b.seatsLeft !== 0);

  const { data: termsVersion } = await supabase
    .from("terms_versions")
    .select("body_text")
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9c5a1e" }}>
        Stage 1 test page — not linked from the live site
      </p>
      <h1 style={{ fontSize: 28, margin: "8px 0 24px" }}>Stripe Subscription Checkout Test</h1>
      <SubscriptionTestForm batches={batches} termsText={termsVersion?.body_text ?? "Terms unavailable."} initialReferralCode={ref} />
    </main>
  );
}
