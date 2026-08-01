import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendStudentPortalAccess } from "@/lib/email/send";

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

/** 192 bits of entropy, URL-safe — see supabase/013_student_portal_access_link.sql. */
function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Best-effort — mirrors the shape of the email helpers in
 * src/lib/email/send.ts ({ok, ...}, never throws). Called right after
 * confirm_enrollment_payment() succeeds; a failure here must NEVER undo or
 * hide the payment confirmation itself.
 *
 * Fully automated: creates the student's portal account (silently — no
 * Supabase email involved), and emails a single permanent, no-password
 * access link (see supabase/013_student_portal_access_link.sql) via this
 * app's own Resend-based sender. Also still generates a password (stored in
 * student_portal_credentials, never emailed here) purely as an admin-panel
 * fallback the admin can hand out manually if ever needed. No manual admin
 * step needed for the normal case.
 *
 * The account/password/token are only ever generated for a BRAND NEW auth
 * account (mode "created") — if this email already has ANY existing account
 * (mode "linked_existing": an admin's login, or a second course for an
 * already-onboarded student), its credentials are never touched or emailed.
 * This is what makes it structurally impossible for this flow to ever
 * repeat the earlier incident where a student's password change
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

      const accessToken = generateAccessToken();
      const { error: tokenError } = await supabase
        .from("student_portal_access")
        .upsert({ student_id: studentId, access_token: accessToken }, { onConflict: "student_id" });

      if (!tokenError) {
        const accessLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/student/access/${accessToken}`;
        await sendStudentPortalAccess(email, { fullName, accessLink });
      }
    }

    return { ok: true, mode: isNewAccount ? "created" : "linked_existing" };
  } catch (error) {
    console.error("[Students] Unexpected error inviting/linking student:", error);
    return { ok: false, mode: "skipped", reason: "unexpected_error" };
  }
}
