import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Same admin check as the /admin dashboard layout (see
 * src/app/admin/(dashboard)/layout.tsx) — these routes aren't covered by
 * proxy.ts (its matcher only guards /admin/:path* and /student/:path*, not
 * /api/:path*), so each handler must verify admin status itself before
 * minting an R2 credential of any kind.
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

export function unauthorized() {
  return NextResponse.json({ error: "Not authorized." }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}
