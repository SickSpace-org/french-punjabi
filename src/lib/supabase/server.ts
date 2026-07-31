import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for Server Components / Server Actions.
 * Reads the caller's session from cookies, so RLS policies apply as that
 * user — never bypasses row-level security.
 */
export async function createClient() {
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
}

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
