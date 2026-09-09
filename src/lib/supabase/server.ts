import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for Server Components / Server Actions.
 * Reads the caller's session from cookies, so RLS policies apply as that
 * user — never bypasses row-level security.
 *
 * Wrapped in React's cache() so every layout/page in a single request's
 * render tree (a "/student" page load routinely nests 2-3 layouts, each
 * of which used to call createClient() + auth.getUser() independently)
 * shares one client instance instead of re-authenticating against the
 * Supabase Auth server once per component — that redundant network round
 * trip per layer was the main cause of slow admin/student navigation.
 * Scoped per-request by Next.js, so a new request still gets a fresh
 * client — this never lets one user's session leak into another's request.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies — the
            // proxy is responsible for refreshing the session in that case.
          }
        },
      },
    }
  );
});

/**
 * Cached per-request alongside createClient() above — every layout/page
 * that needs "is anyone logged in at all" (as opposed to the fuller
 * admin_users/students row lookup each area does on top of it) shares this
 * one auth.getUser() network round trip instead of each calling it fresh.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Public, read-only Supabase client for the anonymous-visitor Courses page.
 * No cookies needed — always reads as the `anon` role, matching what a
 * signed-out visitor is allowed to see under RLS.
 */
export function createPublicClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op: this client never carries a session.
        },
      },
    }
  );
}
