import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import { ToastProvider } from "@/components/admin/ToastProvider";

/**
 * Authorization guard for every /admin page except /admin/login.
 *
 * This is a UX-level guard, not the real security boundary — it only
 * decides whether to render the dashboard shell. The actual enforcement is
 * Row Level Security on every table (see supabase/001_schema.sql,
 * public.is_admin()), which independently blocks any write from a
 * non-admin session even if this check were somehow bypassed.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not_authorized");
  }

  return (
    <ToastProvider>
      <AdminShell email={user.email ?? ""}>{children}</AdminShell>
    </ToastProvider>
  );
}
