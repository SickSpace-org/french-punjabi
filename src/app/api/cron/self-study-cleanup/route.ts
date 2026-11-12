import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredSelfStudy } from "@/lib/selfStudy/cleanup";

export const dynamic = "force-dynamic";

/**
 * Daily Vercel cron (see vercel.json): deletes Self Study files and rows
 * older than 3 days. When CRON_SECRET is set in the Vercel project, Vercel
 * sends it as a Bearer token and anything without it is refused. Even
 * unprotected, all this route can ever do is delete data that has already
 * expired.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredSelfStudy();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[Self Study] Cron cleanup failed:", error);
    return NextResponse.json({ ok: false, error: "Cleanup failed" }, { status: 500 });
  }
}
