import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InviteResult =
  | { ok: true; mode: "invited" | "linked_existing" }
  | { ok: false; mode: "skipped"; reason: string };

/**
 * Best-effort — mirrors the shape of the email helpers in
 * src/lib/email/send.ts ({ok, ...}, never throws). Called right after
 * confirm_enrollment_payment() succeeds; a failure here must NEVER undo or
 * hide the payment confirmation itself.
 *
 * Supabase's Auth Admin API can only be called with the service-role key
 * (Postgres can't call GoTrue's HTTP API), so this has to run here in
 * Node, not inside the security-definer SQL function.
 */
export async function inviteStudentAndLink(studentId: string, email: string): Promise<InviteResult> {
  try {
    const admin = createAdminClient();

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/student/set-password`,
    });

    let authUserId: string | null = null;

    if (!inviteError && inviteData.user) {
      authUserId = inviteData.user.id;
    } else if (inviteError) {
      // Most likely: this email already has an Auth user (already an
      // admin, or a retried invite whose students-row update failed last
      // time) — look it up directly instead of re-inviting.
      const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (listError) {
        return { ok: false, mode: "skipped", reason: listError.message };
      }

      const existingUser = usersPage.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!existingUser) {
        return { ok: false, mode: "skipped", reason: inviteError.message };
      }

      authUserId = existingUser.id;
    }

    if (!authUserId) {
      return { ok: false, mode: "skipped", reason: "No auth user id resolved." };
    }

    // Use the caller's (admin's) RLS-scoped session client for the actual
    // students-table write — students_admin_write already permits it, and
    // this keeps the service-role client's blast radius limited to only
    // the Auth Admin API calls above.
    const supabase = await createClient();
    const { error: linkError } = await supabase
      .from("students")
      .update({ auth_user_id: authUserId })
      .eq("id", studentId);

    if (linkError) {
      return { ok: false, mode: "skipped", reason: linkError.message };
    }

    return { ok: true, mode: inviteError ? "linked_existing" : "invited" };
  } catch (error) {
    console.error("[Students] Unexpected error inviting/linking student:", error);
    return { ok: false, mode: "skipped", reason: "unexpected_error" };
  }
}
