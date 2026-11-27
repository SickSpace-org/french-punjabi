import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredSelfStudy } from "@/lib/selfStudy/cleanup";
import { purgeExpiredAssignments } from "@/lib/assignments/cleanup";
import { releaseStaleOneOnOneHolds } from "@/lib/oneOnOne/staleHolds";

export const dynamic = "force-dynamic";

/**
 * Daily Vercel cron (see vercel.json): deletes Self Study and Assignments
 * files and rows older than 7 days. When CRON_SECRET is set in the Vercel
 * project, Vercel sends it as a Bearer token and anything without it is
 * refused. Even unprotected, all this route can ever do is delete data that
 * has already expired. It also releases personalised one-on-one slots that
 * were reserved but never paid for within 48 hours (see lib/oneOnOne/staleHolds).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [selfStudy, assignments] = await Promise.allSettled([purgeExpiredSelfStudy(), purgeExpiredAssignments()]);
  if (selfStudy.status === "rejected") console.error("[Self Study] Cron cleanup failed:", selfStudy.reason);
  if (assignments.status === "rejected") console.error("[Assignments] Cron cleanup failed:", assignments.reason);

  // Never fails the cron: the sweep swallows its own errors.
  const oneOnOneReleased = await releaseStaleOneOnOneHolds();

  const ok = selfStudy.status === "fulfilled" && assignments.status === "fulfilled";
  return NextResponse.json(
    {
      ok,
      selfStudy: selfStudy.status === "fulfilled" ? selfStudy.value : { error: "Cleanup failed" },
      assignments: assignments.status === "fulfilled" ? assignments.value : { error: "Cleanup failed" },
      oneOnOneReleased,
    },
    { status: ok ? 200 : 500 }
  );
}
