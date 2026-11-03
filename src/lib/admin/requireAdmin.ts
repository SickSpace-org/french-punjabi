import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Same admin check as the /admin dashboard layout and the video-upload
 * routes (src/app/api/admin/video-upload/_shared.ts, left untouched). The
 * Resources admin writes through the service-role client, which bypasses
 * RLS, so every server action and API route MUST call this first — it is the
 * authorization boundary for those writes.
 */
export async function requireAdmin(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  return adminRow ?? null;
}
