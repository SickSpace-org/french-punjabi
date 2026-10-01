import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mirrors src/app/student/access/[token]/route.ts exactly, for teachers —
 * see that file for the full reasoning. Hit by a signed-out browser, so it
 * only ever talks to the DB through the narrow
 * resolve_teacher_portal_access_token() function (see
 * supabase/029_teachers.sql) — never raw table access.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loginUrl = new URL("/teacher/login", request.url);

  if (!token) {
    loginUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .rpc("resolve_teacher_portal_access_token", { p_token: token })
    .maybeSingle();

  if (error || !data) {
    loginUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(loginUrl);
  }

  if (data.status === "DEACTIVATED") {
    loginUrl.searchParams.set("error", "deactivated");
    return NextResponse.redirect(loginUrl);
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: data.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/teacher/verify` },
  });

  if (linkError || !linkData) {
    loginUrl.searchParams.set("error", "not_authorized");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(linkData.properties.action_link);
}
