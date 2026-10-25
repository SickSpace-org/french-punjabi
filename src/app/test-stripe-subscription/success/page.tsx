import { notFound } from "next/navigation";

export default async function TestStripeSubscriptionSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  if (process.env.VERCEL === "1") {
    notFound();
  }

  const { session_id } = await searchParams;
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24 }}>Checkout session completed</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Stripe session: <code>{session_id ?? "(none)"}</code>
      </p>
      <p style={{ color: "#555", fontSize: 14 }}>
        Activation happens asynchronously via the <code>/api/stripe/webhook</code> route once Stripe
        delivers the <code>checkout.session.completed</code> event — check the Stripe CLI output and the
        Supabase <code>students</code>/<code>payment_events</code> tables, not this page, to confirm it
        actually went through.
      </p>
    </main>
  );
}
