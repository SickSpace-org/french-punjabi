import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client — bypasses RLS entirely. The `import
 * "server-only"` guard above makes it a build error to ever import this
 * from a Client Component, so the service-role key can never reach the
 * browser. Only use this for the narrow cases regular RLS-scoped clients
 * genuinely can't do (here: the Auth Admin API for inviting students).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
