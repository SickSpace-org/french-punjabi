import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredSelfStudy } from "@/lib/selfStudy/cleanup";
import { purgeExpiredAssignments } from "@/lib/assignments/cleanup";

export const dynamic = "force-dynamic";

/**
 * Daily Vercel cron (see vercel.json): deletes Self Study and Assignments
 * files and rows older than 3 days. When CRON_SECRET is set in the Vercel
 * project, Vercel sends it as a Bearer token and anything without it is
 * refused. Even unprotected, all this route can ever do is delete data that
 * has already expired.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [selfStudy, assignments] = await Promise.allSettled([purgeExpiredSelfStudy(), purgeExpiredAssignments()]);
  if (selfStudy.status === "rejected") console.error("[Self Study] Cron cleanup failed:", selfStudy.reason);
  if (assignments.status === "rejected") console.error("[Assignments] Cron cleanup failed:", assignments.reason);

  const ok = selfStudy.status === "fulfilled" && assignments.status === "fulfilled";
  return NextResponse.json(
    {
      ok,
      selfStudy: selfStudy.status === "fulfilled" ? selfStudy.value : { error: "Cleanup failed" },
      assignments: assignments.status === "fulfilled" ? assignments.value : { error: "Cleanup failed" },
    },
    { status: ok ? 200 : 500 }
  );
}
