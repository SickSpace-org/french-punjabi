import { createClient } from "@/lib/supabase/server";
import { getAdminOneOnOne } from "@/lib/oneOnOne/getAdminOneOnOne";
import OneOnOneClient from "@/components/admin/oneOnOne/OneOnOneClient";

export const revalidate = 0;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-navy/60">{children}</p>
    </div>
  );
}

export default async function AdminOneOnOnePage() {
  const supabase = await createClient();

  let data: Awaited<ReturnType<typeof getAdminOneOnOne>> | null = null;
  try {
    data = await getAdminOneOnOne(supabase);
  } catch (error) {
    console.error("[Admin] Failed to load one-on-one slots:", error);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Personalised One-on-One</h1>
      <p className="mt-1 text-sm text-navy/60">
        Open private 30-minute slots under each phase. A slot is held for the first person who submits the
        form; confirm their payment in Enrollments to add them to the portal. If they quit, reopen the slot here.
      </p>

      {!data ? (
        <Notice>
          Couldn&apos;t load one-on-one slots. If you haven&apos;t yet, run{" "}
          <code>supabase/067_personalised_one_on_one.sql</code> in the Supabase SQL Editor, then refresh.
        </Notice>
      ) : (
        <div className="mt-8">
          <OneOnOneClient data={data} />
        </div>
      )}
    </div>
  );
}
