import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AssignmentsTableMissingError, getAdminAssignments } from "@/lib/assignments/getAssignments";
import { purgeExpiredAssignmentsThrottled } from "@/lib/assignments/cleanup";
import { ASSIGNMENT_RETENTION_DAYS } from "@/lib/assignments/constants";
import AdminAssignmentsClient from "@/components/assignments/AdminAssignmentsClient";

export const revalidate = 0;

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-navy/60">{children}</p>
    </div>
  );
}

export default async function AdminAssignmentsPage() {
  const supabase = await createClient();
  after(purgeExpiredAssignmentsThrottled);

  let data: Awaited<ReturnType<typeof getAdminAssignments>> | null = null;
  let tableMissing = false;
  try {
    data = await getAdminAssignments(supabase);
  } catch (error) {
    if (error instanceof AssignmentsTableMissingError) tableMissing = true;
    else console.error("[Admin] Failed to load assignments:", error);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Assignments</h1>
      <p className="mt-1 text-sm text-navy/60">
        {`Share assignment PDFs with students, then open the PDFs they submit and mark them checked. Every file is deleted automatically ${ASSIGNMENT_RETENTION_DAYS} days after it's uploaded.`}
      </p>

      {tableMissing ? (
        <Notice>
          Assignments aren&apos;t set up yet. Run <code>supabase/066_assignments.sql</code> in the Supabase SQL
          Editor, then refresh.
        </Notice>
      ) : !data ? (
        <Notice>Couldn&apos;t load assignments right now. Please refresh the page.</Notice>
      ) : (
        <div className="mt-6">
          <AdminAssignmentsClient data={data} />
        </div>
      )}
    </div>
  );
}
