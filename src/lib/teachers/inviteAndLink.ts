import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendTeacherPortalAccess } from "@/lib/email/send";

export type TeacherInviteResult =
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

/** 192 bits of entropy, URL-safe — see supabase/029_teachers.sql. */
function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Mirrors inviteStudentAndLink (src/lib/students/inviteAndLink.ts) exactly,
 * just for teachers — see that file for the full reasoning. Called right
 * after an admin adds a teacher by email (see addTeacher in
 * src/app/admin/(dashboard)/teachers/actions.ts); a failure here must
 * never undo or hide the teacher row itself.
 *
 * The account/password/token are only ever generated for a BRAND NEW auth
 * account (mode "created") — if this email already has ANY existing
 * account (an admin's login, a student portal account, or another
 * teacher), its credentials are never touched or emailed, so this can
 * never accidentally lock someone else out of their existing account.
 */
export async function inviteTeacherAndLink(
  teacherId: string,
  email: string,
  fullName: string
): Promise<TeacherInviteResult> {
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
    // teachers-table write — teachers_admin_write already permits it, and
    // this keeps the service-role client's blast radius limited to only
    // the Auth Admin API calls above.
    const supabase = await createClient();
    const { error: linkError } = await supabase
      .from("teachers")
      .update({ auth_user_id: authUserId })
      .eq("id", teacherId);

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
        .from("teacher_portal_credentials")
        .upsert({ teacher_id: teacherId, password }, { onConflict: "teacher_id" });

      const accessToken = generateAccessToken();
      const { error: tokenError } = await supabase
        .from("teacher_portal_access")
        .upsert({ teacher_id: teacherId, access_token: accessToken }, { onConflict: "teacher_id" });

      if (!tokenError) {
        const accessLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/teacher/access/${accessToken}`;
        await sendTeacherPortalAccess(email, { fullName, accessLink });
      }
    }

    return { ok: true, mode: isNewAccount ? "created" : "linked_existing" };
  } catch (error) {
    console.error("[Teachers] Unexpected error inviting/linking teacher:", error);
    return { ok: false, mode: "skipped", reason: "unexpected_error" };
  }
}
