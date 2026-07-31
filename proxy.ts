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
    // /student/set-password is reached via the invite email link, which
    // establishes the session client-side — never bounce it through a
    // server-side "are you logged in yet" check.
    const isPublicStudentPage =
      pathname === "/student/login" || pathname === "/student/set-password";

    if (!user && !isPublicStudentPage) {
      return NextResponse.redirect(new URL("/student/login", request.url));
    }
    return response;
  }

  const isLoginPage = pathname === "/admin/login";

  if (!user && !isLoginPage) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const proxyConfig = {
  matcher: ["/admin/:path*", "/student/:path*"],
};
