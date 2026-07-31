import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every /admin and /student
 * request and redirects signed-out visitors to the matching login page.
 * This is a UX-level guard, not the security boundary — actual
 * authorization (is this user an approved admin? an ACTIVE student? do
 * they have access to this specific course?) is enforced by the relevant
 * layout's DB check and, most importantly, by Row Level Security on every
 * table.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/student")) {
    // /student/verify is reached via every invite/magic-link email — the
    // session token arrives in the URL fragment, which never reaches the
    // server, so this page has to load and run its own client-side JS
    // before any server-side "are you logged in yet" check would apply.
    const isPublicStudentPage = pathname === "/student/login" || pathname === "/student/verify";

    if (!user && !isPublicStudentPage) {
      return NextResponse.redirect(new URL("/student/login", request.url));
    }
    return response;
  }

  // /admin/reset-password is reached via a Supabase password-recovery
  // email link — same reasoning as /student/verify above, the recovery
  // token arrives in the URL fragment and has to be picked up client-side
  // before any server-side "are you logged in" check would apply.
  const isPublicAdminPage = pathname === "/admin/login" || pathname === "/admin/reset-password";

  if (!user && !isPublicAdminPage) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const proxyConfig = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
