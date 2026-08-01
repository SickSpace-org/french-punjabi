import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The student's entire onboarding step, post-payment: click this one
 * bookmarkable link, land in the portal — no password, no code. Hit by a
 * signed-out browser, so it only ever talks to the DB through the narrow
 * resolve_portal_access_token() function (see
 * supabase/013_student_portal_access_link.sql) — never raw table access.
 *
 * The token itself never expires, but each visit mints a FRESH, single-use
 * Supabase magic link server-side and redirects straight into it — so the
 * durable secret a scanner or the student holds is always OUR token, never
 * a Supabase one-time link. That's what makes this immune to the "email
 * security scanner pre-visits and burns the link" problem that affected
 * the old link-based invite email.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const loginUrl = new URL("/student/login", request.url);

  if (!token) {
    loginUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .rpc("resolve_portal_access_token", { p_token: token })
    .maybeSingle();

  if (error || !data) {
    loginUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(loginUrl);
  }

  if (data.status === "SUSPENDED") {
    loginUrl.searchParams.set("error", "suspended");
    return NextResponse.redirect(loginUrl);
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: data.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/student/verify` },
  });

  if (linkError || !linkData) {
    loginUrl.searchParams.set("error", "not_authorized");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(linkData.properties.action_link);
}
