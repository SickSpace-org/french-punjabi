import { getAuthUser } from "@/lib/supabase/server";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";

export default async function AdminProfilePage() {
  const user = await getAuthUser();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Profile</h1>
      <p className="mt-1 text-sm text-navy/60">{user?.email}</p>

      <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Change Password</p>
        <p className="mt-1 text-sm text-navy/60">
          Type your new password directly here — it goes straight to your account, nowhere else.
        </p>
        <div className="mt-4">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
