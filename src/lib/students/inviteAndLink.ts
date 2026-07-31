import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendStudentLoginCredentials } from "@/lib/email/send";

export type InviteResult =
  | { ok: true; mode: "created" | "linked_existing" }
  | { ok: false; mode: "skipped"; reason: string };

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generatePassword(): string {
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)];
  }
  return password;
}

/**
 * Best-effort — mirrors the shape of the email helpers in
 * src/lib/email/send.ts ({ok, ...}, never throws). Called right after
 * confirm_enrollment_payment() succeeds; a failure here must NEVER undo or
 * hide the payment confirmation itself.
 *
 * Fully automated: creates the student's portal account (silently — no
 * Supabase email involved), generates a unique password for THAT student,
 * and emails both the password and a ready-to-click sign-in link together
 * via this app's own Resend-based sender. No manual admin step needed.
 *
 * The password is only ever generated/set for a BRAND NEW auth account
 * (mode "created") — if this email already has ANY existing account
 * (mode "linked_existing": an admin's login, or a second course for an
 * already-onboarded student), its password/credentials are never touched
 * or emailed. This is what makes it structurally impossible for this flow
 * to ever repeat the earlier incident where a student's password change
 * accidentally locked out an admin sharing the same email — a fresh
 * account can never collide with an existing one.
 */
export async function inviteStudentAndLink(
  studentId: string,
  email: string,
  fullName: string
): Promise<InviteResult> {
  try {
    const admin = createAdminClient();

    const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      return { ok: false, mode: "skipped", reason: listError.message };
    }

    let authUserId =
      usersPage.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
    const isNewAccount = !authUserId;

    if (!authUserId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createError || !created.user) {
        return { ok: false, mode: "skipped", reason: createError?.message ?? "Failed to create account." };
      }
      authUserId = created.user.id;
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

    if (isNewAccount) {
      const password = generatePassword();
      const { error: pwError } = await admin.auth.admin.updateUserById(authUserId, { password });
      if (pwError) {
        return { ok: false, mode: "skipped", reason: pwError.message };
      }

      await supabase
        .from("student_portal_credentials")
        .upsert({ student_id: studentId, password }, { onConflict: "student_id" });

      const { data: linkData, error: genLinkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/student/verify` },
      });

      if (!genLinkError && linkData) {
        await sendStudentLoginCredentials(email, {
          fullName,
          loginLink: linkData.properties.action_link,
          password,
        });
      }
    }

    return { ok: true, mode: isNewAccount ? "created" : "linked_existing" };
  } catch (error) {
    console.error("[Students] Unexpected error inviting/linking student:", error);
    return { ok: false, mode: "skipped", reason: "unexpected_error" };
  }
}
