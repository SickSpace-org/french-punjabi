import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminSelfStudy, SelfStudyTableMissingError } from "@/lib/selfStudy/getSelfStudy";
import { purgeExpiredSelfStudyThrottled } from "@/lib/selfStudy/cleanup";
import { SELF_STUDY_RETENTION_DAYS } from "@/lib/selfStudy/constants";
import AdminSelfStudyClient from "@/components/selfStudy/AdminSelfStudyClient";

export const revalidate = 0;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-navy/60">{children}</p>
    </div>
  );
}

export default async function AdminSelfStudyPage() {
  const supabase = await createClient();
  after(purgeExpiredSelfStudyThrottled);

  let data: Awaited<ReturnType<typeof getAdminSelfStudy>> | null = null;
  let tableMissing = false;
  try {
    data = await getAdminSelfStudy(supabase);
  } catch (error) {
    if (error instanceof SelfStudyTableMissingError) tableMissing = true;
    else console.error("[Admin] Failed to load self study:", error);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Self Study</h1>
      <p className="mt-1 text-sm text-navy/60">
        {`Homework PDFs you share with students, and the PDFs and voice recordings they send back. Every file is deleted automatically ${SELF_STUDY_RETENTION_DAYS} days after it's uploaded.`}
      </p>

      {tableMissing ? (
        <Notice>
          Self Study isn&apos;t set up yet. Run <code>supabase/065_self_study.sql</code> in the Supabase SQL
          Editor, then refresh.
        </Notice>
      ) : !data ? (
        <Notice>Couldn&apos;t load Self Study right now. Please refresh the page.</Notice>
      ) : (
        <div className="mt-6">
          <AdminSelfStudyClient data={data} />
        </div>
      )}
    </div>
  );
}
