import { createClient } from "@/lib/supabase/server";
import { getAdminWaitlist, WaitlistTableMissingError } from "@/lib/waitlist/getAdminWaitlist";
import WaitlistClient from "@/components/admin/waitlist/WaitlistClient";

export const revalidate = 0;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-navy/60">{children}</p>
    </div>
  );
}

export default async function AdminWaitlistPage() {
  const supabase = await createClient();

  let batches: Awaited<ReturnType<typeof getAdminWaitlist>> | null = null;
  let tableMissing = false;
  try {
    batches = await getAdminWaitlist(supabase);
  } catch (error) {
    if (error instanceof WaitlistTableMissingError) tableMissing = true;
    else console.error("[Admin] Failed to load waitlist:", error);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Waitlist</h1>
      <p className="mt-1 text-sm text-navy/60">
        Students waiting for a seat in a full batch. They&apos;re emailed automatically when you free
        a seat in Courses, or you can email them yourself here.
      </p>

      {tableMissing ? (
        <Notice>
          The waitlist table doesn&apos;t exist yet. Run <code>supabase/030_batch_waitlist.sql</code> in
          the Supabase SQL Editor, then refresh.
        </Notice>
      ) : !batches ? (
        <Notice>Couldn&apos;t load the waitlist right now. Please refresh the page.</Notice>
      ) : batches.length === 0 ? (
        <Notice>Nobody is on a waitlist yet.</Notice>
      ) : (
        <div className="mt-8">
          <WaitlistClient batches={batches} />
        </div>
      )}
    </div>
  );
}
