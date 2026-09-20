"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteStudentAndLink } from "@/lib/students/inviteAndLink";
import { sendFeeReminderEmail, sendStudentLoginCredentials, sendStudentPortalAccess } from "@/lib/email/send";
import { formatBatchTiming, formatCourseLabel } from "@/lib/courses/batchLabel";

/** 192 bits of entropy, URL-safe — mirrors inviteAndLink.ts's generator. */
function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateStudent(studentId: string) {
  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);
}

/**
 * The actions below (portal invite/password/delete) call Supabase's Auth
 * Admin API via a service-role client, which has no RLS to fall back on —
 * unlike every other action in this file, which relies purely on
 * students_admin_write. So these explicitly re-check is_admin() themselves
 * first, the same way confirm_enrollment_payment() does inside Postgres.
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
 * Hard safety check: a students row can end up sharing its auth_user_id
 * with an actual admin login (e.g. someone tested enrollment using their
 * own admin email — this has already happened once in this project and
 * locked the admin out when a student password got changed on it).
 * Anything that mutates or exposes the underlying Auth account must
 * refuse outright if that account is also an admin_users row, rather than
 * relying on nobody ever doing this again.
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
        "This student's login is the same account as an admin login (same email was used for both). Refusing to change its password/credentials to avoid locking out an admin.",
    };
  }

  return { ok: true };
}

export type SendInviteResult =
  | { ok: true; mode: "created" | "linked_existing" }
  | { ok: false; error: string };

/** For a student who was never auto-invited (or the original attempt
 * failed) — safe to call again, inviteStudentAndLink is itself idempotent.
 * Auto-generates and emails a unique password + sign-in link together
 * when this creates a brand new account. */
export async function sendPortalInvite(studentId: string): Promise<SendInviteResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("email, full_name")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "Student not found." };

  const result = await inviteStudentAndLink(studentId, student.email, student.full_name);
  if (!result.ok) return { ok: false, error: result.reason };

  revalidateStudent(studentId);
  return { ok: true, mode: result.mode };
}

/** Sends a passwordless magic-link login email — the normal, everyday way
 * a student gets back in (this app never asks them to create/remember a
 * password). Works even if their account was silently linked to an
 * existing auth user (so no invite email ever went out) or their
 * original invite never arrived. */
export async function sendLoginLink(studentId: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("email, auth_user_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "Student not found." };
  if (!student.auth_user_id) {
    return { ok: false, error: "This student hasn't been invited yet — send a portal invite first." };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: student.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/student/verify`,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Sets (or changes) a permanent, admin-chosen password directly on the
 * student's Auth account — only ever for a student whose payment is
 * already confirmed and who has an active portal account (auth_user_id
 * set). Also stores a plaintext copy in student_portal_credentials (a
 * separate, admin-only table — see supabase/011_student_portal_credentials.sql)
 * so the admin can view/edit it again later, since Supabase itself never
 * lets anyone read a password back once set.
 */
export async function setStudentPassword(studentId: string, password: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("auth_user_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "Student not found." };
  if (!student.auth_user_id) {
    return { ok: false, error: "This student hasn't been invited yet — send a portal invite first." };
  }

  const adminCheck = await assertNotAdminAccount(supabase, student.auth_user_id);
  if (!adminCheck.ok) return adminCheck;

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(student.auth_user_id, { password });
  if (authError) return { ok: false, error: authError.message };

  const { error: storeError } = await supabase
    .from("student_portal_credentials")
    .upsert({ student_id: studentId, password }, { onConflict: "student_id" });
  if (storeError) return { ok: false, error: storeError.message };

  revalidateStudent(studentId);
  return { ok: true };
}

/**
 * Emails the CURRENTLY SAVED password (set via setStudentPassword above)
 * together with a fresh one-time sign-in CODE, via this app's own
 * Resend-based sender — separate from Supabase's built-in mailer, so it
 * isn't subject to that service's rate limit.
 *
 * Sends the raw OTP code rather than a clickable action_link on purpose —
 * a one-click link sitting in an email gets silently pre-visited (and so
 * burned) by corporate mail security scanners before the student ever
 * opens it, which is what made the old link-based email expire within
 * seconds for some students. See studentLoginCredentialsHtml.
 */
export async function sendPasswordToStudent(studentId: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("email, full_name, auth_user_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "Student not found." };
  if (!student.auth_user_id) {
    return { ok: false, error: "This student hasn't been invited yet — send a portal invite first." };
  }

  const adminCheck = await assertNotAdminAccount(supabase, student.auth_user_id);
  if (!adminCheck.ok) return adminCheck;

  const { data: credential } = await supabase
    .from("student_portal_credentials")
    .select("password")
    .eq("student_id", studentId)
    .maybeSingle();
  if (!credential) {
    return { ok: false, error: "Set a password first, then send it." };
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: student.email,
  });
  if (linkError || !linkData) {
    return { ok: false, error: linkError?.message ?? "Failed to generate a sign-in code." };
  }

  const result = await sendStudentLoginCredentials(student.email, {
    fullName: student.full_name,
    code: linkData.properties.email_otp,
    password: credential.password,
  });

  if (!result.sent) {
    return { ok: false, error: result.reason ?? "Failed to send the email." };
  }

  return { ok: true };
}

/**
 * Rotates this student's permanent portal-access token (see
 * supabase/013_student_portal_access_link.sql) and emails the new link —
 * the old link stops working the instant this runs. Use when a link may
 * have leaked, or to resend it (there's no separate "just resend" action;
 * regenerating and resending are the same operation, since silently
 * resending the SAME link would do nothing for someone who lost the
 * original email).
 */
export type RegenerateLinkResult =
  | { ok: true; accessLink: string }
  | { ok: false; error: string };

export async function regeneratePortalAccessLink(studentId: string): Promise<RegenerateLinkResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("email, full_name, auth_user_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "Student not found." };
  if (!student.auth_user_id) {
    return { ok: false, error: "This student hasn't been invited yet — send a portal invite first." };
  }

  const accessToken = generateAccessToken();
  const { error: tokenError } = await supabase
    .from("student_portal_access")
    .upsert({ student_id: studentId, access_token: accessToken }, { onConflict: "student_id" });
  if (tokenError) return { ok: false, error: tokenError.message };

  const accessLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/student/access/${accessToken}`;
  const result = await sendStudentPortalAccess(student.email, {
    fullName: student.full_name,
    accessLink,
  });

  if (!result.sent) {
    return { ok: false, error: result.reason ?? "Failed to send the email." };
  }

  revalidateStudent(studentId);
  return { ok: true, accessLink };
}

/**
 * Full, permanent removal — the auth login AND the account record,
 * including their progress/comments/notifications/course-access history
 * (all cascade via the students row). Enrollments referencing this student
 * are unlinked (student_id set null) rather than blocked or deleted, since
 * enrollment records are kept permanently regardless of account state.
 */
export async function deleteStudentAccount(studentId: string): Promise<ActionResult> {
  const authCheck = await requireAdmin();
  if (!authCheck.ok) return authCheck;

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("auth_user_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "Student not found." };

  if (student.auth_user_id) {
    const adminCheck = await assertNotAdminAccount(supabase, student.auth_user_id);
    if (!adminCheck.ok) return adminCheck;
  }

  const { error: unlinkError } = await supabase
    .from("enrollments")
    .update({ student_id: null })
    .eq("student_id", studentId);
  if (unlinkError) return { ok: false, error: unlinkError.message };

  const { error: deleteError } = await supabase.from("students").delete().eq("id", studentId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (student.auth_user_id) {
    const admin = createAdminClient();
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(student.auth_user_id);
    if (authDeleteError) {
      console.error("[Students] Deleted account row but failed to delete auth user:", authDeleteError);
    }
  }

  revalidatePath("/admin/students");
  redirect("/admin/students");
}

/**
 * Relies on Supabase RLS (public.is_admin()) as the real authorization
 * boundary, same as the other admin actions files — the server client
 * carries the caller's session, so a non-admin session's write is
 * rejected by the database regardless of this file.
 */
export async function suspendStudent(studentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ status: "SUSPENDED" })
    .eq("id", studentId);

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}

export async function reactivateStudent(studentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ status: "ACTIVE" }).eq("id", studentId);

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}

export type StudentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

/**
 * Generic status setter behind the editable dropdown in the students list —
 * covers all three allowed values (suspendStudent/reactivateStudent above
 * only ever toggle between ACTIVE and SUSPENDED). Same plain-RLS pattern:
 * students_admin_write is the real authorization boundary.
 */
export async function setStudentStatus(studentId: string, status: StudentStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ status }).eq("id", studentId);

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}

/**
 * Lets an admin correct the enrolled date shown on a student's record
 * (e.g. it was auto-set to "today" at payment-confirmation time, but the
 * actual enrollment happened earlier/later). `enrolledAt` is a plain
 * "YYYY-MM-DD" date-input value; Postgres casts it to timestamptz at
 * midnight. Same plain-RLS pattern as suspendStudent/reactivateStudent.
 */
export async function updateStudentEnrolledDate(studentId: string, enrolledAt: string): Promise<ActionResult> {
  if (!enrolledAt || Number.isNaN(new Date(enrolledAt).getTime())) {
    return { ok: false, error: "Please enter a valid date." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ enrolled_at: enrolledAt }).eq("id", studentId);

  if (error) return { ok: false, error: error.message };
  revalidateStudent(studentId);
  return { ok: true };
}

/**
 * Admin-triggered, on demand, from the Students tab — a general fees-due
 * nudge for an already-enrolled student, separate from sendPaymentReminder
 * in enrollments/actions.ts (which only applies to a still-PENDING
 * enrollment's one-time signup payment). Can be re-sent any number of
 * times, e.g. every billing cycle.
 *
 * `dueDate` is entered fresh by the admin at send time rather than read
 * from a saved column — there's no persisted "next payment due" field on
 * students yet (that needs a migration; see
 * supabase/015_student_fee_reminder.sql, not yet applied). Once that lands,
 * this can default to the saved date instead of requiring re-entry each
 * time.
 */
export async function sendFeeReminder(studentId: string, dueDate: string | null): Promise<ActionResult> {
  if (dueDate && Number.isNaN(new Date(dueDate).getTime())) {
    return { ok: false, error: "Please enter a valid date." };
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("email, full_name")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { ok: false, error: "Student not found." };

  const result = await sendFeeReminderEmail(student.email, {
    fullName: student.full_name,
    dueDate,
  });

  if (!result.sent) {
    return {
      ok: false,
      error:
        result.reason === "not_configured"
          ? "Email sending is not configured."
          : "Failed to send reminder email. Please try again.",
    };
  }

  return { ok: true };
}

type BatchLookupRow = {
  id: string;
  phase_id: string | null;
  level_id: string | null;
  name: string | null;
  time_label: string;
  timezone: string;
  phases: { title: string } | null;
  levels: { phase_id: string; name: string; phases: { title: string } | null } | null;
};

/**
 * Re-points a student's current course selection at a different batch —
 * updates the phase/level/batch fields on their most recently confirmed
 * enrollment (`enrollmentId`, from getAdminStudents' current_enrollment_id)
 * rather than the students row, since phase/level/batch live on
 * `enrollments` (see 006_student_accounts.sql). Re-derives phase_name/
 * level_name/batch_timing from the batch itself — same source of truth
 * submitEnrollment() uses — rather than trusting client-supplied labels.
 */
export async function updateStudentCourse(
  enrollmentId: string,
  studentId: string,
  batchId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const [{ data, error: batchError }, { data: previous, error: previousError }] = await Promise.all([
    supabase
      .from("batches")
      .select("id, phase_id, level_id, name, time_label, timezone, phases ( title ), levels ( phase_id, name, phases ( title ) )")
      .eq("id", batchId)
      .maybeSingle(),
    supabase.from("enrollments").select("phase_name, level_name, batch_timing").eq("id", enrollmentId).maybeSingle(),
  ]);

  const batch = data as unknown as BatchLookupRow | null;
  if (batchError || !batch) return { ok: false, error: "Batch not found." };
  if (previousError) return { ok: false, error: previousError.message };

  const phaseName = batch.phases?.title ?? batch.levels?.phases?.title ?? null;
  if (!phaseName) return { ok: false, error: "This batch has no parent phase — can't assign it." };

  // A level-nested batch only carries level_id (its own phase_id is null —
  // see 001_schema.sql) — its parent phase comes through the level instead.
  // Writing batch.phase_id straight through here used to null out phase_id
  // on the enrollment for exactly this (the common) case, which made the
  // live name resolver treat a perfectly live phase as deleted and show it
  // as "Foundation (removed)" on Students.
  const resolvedPhaseId = batch.phase_id ?? batch.levels?.phase_id ?? null;

  const levelName = batch.levels?.name ?? null;
  const batchTiming = formatBatchTiming(batch);

  const { error } = await supabase
    .from("enrollments")
    .update({
      phase_id: resolvedPhaseId,
      level_id: batch.level_id,
      batch_id: batch.id,
      phase_name: phaseName,
      level_name: levelName,
      batch_timing: batchTiming,
    })
    .eq("id", enrollmentId);

  if (error) return { ok: false, error: error.message };

  // Best-effort — see swap-batches/actions.ts's swapBatch for why a history
  // logging failure must never surface as a failure of the reassignment
  // itself, which has already succeeded above.
  if (previous) {
    const { error: historyError } = await supabase.from("batch_change_history").insert({
      student_id: studentId,
      enrollment_id: enrollmentId,
      from_label: formatCourseLabel(previous.phase_name, previous.level_name, previous.batch_timing),
      to_label: formatCourseLabel(phaseName, levelName, batchTiming),
    });
    if (historyError) console.error("batch_change_history insert failed:", historyError.message);
  }

  revalidateStudent(studentId);
  revalidatePath("/admin/enrollments");
  return { ok: true };
}
