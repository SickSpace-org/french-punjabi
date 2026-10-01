"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteTeacherAndLink } from "@/lib/teachers/inviteAndLink";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateTeachers(teacherId?: string) {
  revalidatePath("/admin/teachers");
  if (teacherId) revalidatePath(`/admin/teachers/${teacherId}`);
  // Batch assignment / display touches Courses and Attendance too.
  revalidatePath("/admin/courses");
  revalidatePath("/admin/attendance");
}

/**
 * The actions below (invite/delete) call Supabase's Auth Admin API via a
 * service-role client, which has no RLS to fall back on — unlike every
 * other action in this file, which relies purely on teachers_admin_write.
 * So these explicitly re-check is_admin() themselves first, the same way
 * the equivalent student actions do (see students/[studentId]/actions.ts).
 */
async function requireAdmin(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) return { ok: false, error: "Not authorized." };

  return { ok: true };
}

/**
 * Hard safety check mirroring assertNotAdminAccount in
 * students/[studentId]/actions.ts — a teacher's auth account could
 * coincidentally share an email with an admin or student login. Anything
 * that deletes the underlying Auth account must refuse outright if that
 * account is also an admin_users row, rather than relying on nobody ever
 * doing this again.
 */
async function assertNotAdminAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string
): Promise<ActionResult> {
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();

  if (adminRow) {
    return {
      ok: false,
      error:
        "This teacher's login is the same account as an admin login (same email was used for both). Refusing to delete it to avoid locking out an admin.",
    };
  }

  return { ok: true };
}

export type AddTeacherResult =
  | { ok: true; teacherId: string; inviteMode: "created" | "linked_existing" }
  | { ok: false; error: string };

/**
 * Admin-only: teachers can never self-register (see supabase/029_teachers.sql
 * — no insert policy exists for a non-admin session). Creates the teachers
 * row, then immediately reuses the same invite-email mechanism the student
 * portal uses (see inviteTeacherAndLink) to provision their login and send
 * a portal-access email.
 */
export async function addTeacher(fullName: string, email: string): Promise<AddTeacherResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();
  if (!trimmedName) return { ok: false, error: "Name is required." };
  if (!trimmedEmail) return { ok: false, error: "Email is required." };

  const supabase = await createClient();
  const { data: teacher, error: insertError } = await supabase
    .from("teachers")
    .insert({ full_name: trimmedName, email: trimmedEmail })
    .select("id")
    .single();

  if (insertError || !teacher) {
    const isDuplicate = insertError?.code === "23505";
    return {
      ok: false,
      error: isDuplicate ? "A teacher with this email already exists." : insertError?.message ?? "Failed to add teacher.",
    };
  }

  const inviteResult = await inviteTeacherAndLink(teacher.id, trimmedEmail, trimmedName);
  if (!inviteResult.ok) {
    // The teacher row is already saved — an admin can retry the invite from
    // the detail page (resendTeacherInvite) rather than losing the record.
    console.error("[Teachers] Added teacher but invite failed:", inviteResult.reason);
    revalidateTeachers();
    return { ok: true, teacherId: teacher.id, inviteMode: "linked_existing" };
  }

  revalidateTeachers();
  return { ok: true, teacherId: teacher.id, inviteMode: inviteResult.mode };
}

export type SendInviteResult =
  | { ok: true; mode: "created" | "linked_existing" }
  | { ok: false; error: string };

/** For a teacher whose invite failed the first time — safe to call again, inviteTeacherAndLink is itself idempotent. */
export async function resendTeacherInvite(teacherId: string): Promise<SendInviteResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("email, full_name")
    .eq("id", teacherId)
    .maybeSingle();
  if (!teacher) return { ok: false, error: "Teacher not found." };

  const result = await inviteTeacherAndLink(teacherId, teacher.email, teacher.full_name);
  if (!result.ok) return { ok: false, error: result.reason };

  revalidateTeachers(teacherId);
  return { ok: true, mode: result.mode };
}

/** Pauses portal access without deleting anything — history (attendance marked, payments, hours, batch assignment) is all preserved. Reversible via reactivateTeacher. */
export async function deactivateTeacher(teacherId: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { error } = await supabase.from("teachers").update({ status: "DEACTIVATED" }).eq("id", teacherId);
  if (error) return { ok: false, error: error.message };

  revalidateTeachers(teacherId);
  return { ok: true };
}

export async function reactivateTeacher(teacherId: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { error } = await supabase.from("teachers").update({ status: "ACTIVE" }).eq("id", teacherId);
  if (error) return { ok: false, error: error.message };

  revalidateTeachers(teacherId);
  return { ok: true };
}

/**
 * Permanently deletes the teacher's account and login. Their batch
 * assignment falls back to unassigned (batches.teacher_id ON DELETE SET
 * NULL) and any payments/hours/attendance rows they're tied to are kept —
 * see supabase/029_teachers.sql for why those use SET NULL + a frozen
 * teacher_name_snapshot instead of CASCADE. Mirrors deleteStudentAccount.
 */
export async function removeTeacher(teacherId: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("auth_user_id")
    .eq("id", teacherId)
    .maybeSingle();
  if (!teacher) return { ok: false, error: "Teacher not found." };

  if (teacher.auth_user_id) {
    const adminCheck = await assertNotAdminAccount(supabase, teacher.auth_user_id);
    if (!adminCheck.ok) return adminCheck;
  }

  const { error: deleteError } = await supabase.from("teachers").delete().eq("id", teacherId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (teacher.auth_user_id) {
    const admin = createAdminClient();
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(teacher.auth_user_id);
    if (authDeleteError) {
      console.error("[Teachers] Deleted teacher row but failed to delete auth user:", authDeleteError);
    }
  }

  revalidateTeachers();
  redirect("/admin/teachers");
}

/**
 * Sets/resets this teacher's permanent portal password — mirrors
 * setStudentPassword (students/[studentId]/actions.ts) exactly. Stored in
 * teacher_portal_credentials, which has no self-select RLS policy at all
 * (see supabase/029_teachers.sql), so this value is never reachable by
 * the teacher's own session — only from here, admin-only.
 */
export async function setTeacherPassword(teacherId: string, password: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { data: teacher } = await supabase.from("teachers").select("auth_user_id").eq("id", teacherId).maybeSingle();
  if (!teacher) return { ok: false, error: "Teacher not found." };
  if (!teacher.auth_user_id) {
    return { ok: false, error: "This teacher hasn't been invited yet — send an invite first." };
  }

  const adminCheck = await assertNotAdminAccount(supabase, teacher.auth_user_id);
  if (!adminCheck.ok) return adminCheck;

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(teacher.auth_user_id, { password });
  if (authError) return { ok: false, error: authError.message };

  const { error: storeError } = await supabase
    .from("teacher_portal_credentials")
    .upsert({ teacher_id: teacherId, password }, { onConflict: "teacher_id" });
  if (storeError) return { ok: false, error: storeError.message };

  revalidateTeachers(teacherId);
  return { ok: true };
}

export type TeacherPaymentInput = { amount: number; currency: string; paidAt: string; note: string };

/** Admin-only bookkeeping — see supabase/029_teachers.sql, there is no RLS path for a teacher's own session to ever read this. */
export async function addTeacherPayment(teacherId: string, input: TeacherPaymentInput): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: teacher } = await supabase.from("teachers").select("full_name").eq("id", teacherId).maybeSingle();
  if (!teacher) return { ok: false, error: "Teacher not found." };

  const { error } = await supabase.from("teacher_payments").insert({
    teacher_id: teacherId,
    teacher_name_snapshot: teacher.full_name,
    amount: input.amount,
    currency: input.currency || "CAD",
    paid_at: input.paidAt,
    note: input.note || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidateTeachers(teacherId);
  return { ok: true };
}

export async function deleteTeacherPayment(paymentId: string, teacherId: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { error } = await supabase.from("teacher_payments").delete().eq("id", paymentId);
  if (error) return { ok: false, error: error.message };

  revalidateTeachers(teacherId);
  return { ok: true };
}

export type TeacherHoursInput = { weekStart: string; hours: number; note: string };

/** Upserts by (teacher_id, week_start) — re-entering the same week overwrites it rather than erroring on the unique constraint. */
export async function setTeacherHours(teacherId: string, input: TeacherHoursInput): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: teacher } = await supabase.from("teachers").select("full_name").eq("id", teacherId).maybeSingle();
  if (!teacher) return { ok: false, error: "Teacher not found." };

  const { error } = await supabase.from("teacher_hours").upsert(
    {
      teacher_id: teacherId,
      teacher_name_snapshot: teacher.full_name,
      week_start: input.weekStart,
      hours: input.hours,
      note: input.note || null,
    },
    { onConflict: "teacher_id,week_start" }
  );
  if (error) return { ok: false, error: error.message };

  revalidateTeachers(teacherId);
  return { ok: true };
}

export async function deleteTeacherHours(hoursId: string, teacherId: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { error } = await supabase.from("teacher_hours").delete().eq("id", hoursId);
  if (error) return { ok: false, error: error.message };

  revalidateTeachers(teacherId);
  return { ok: true };
}
