"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContentStatus } from "@/types/database";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Every mutation below relies on Supabase RLS (public.is_admin(), see
 * supabase/007_course_content.sql) as the real authorization boundary,
 * same as src/app/admin/(dashboard)/courses/actions.ts.
 */
function revalidateContent(courseId?: string) {
  revalidatePath("/admin/content");
  if (courseId) revalidatePath(`/admin/content/${courseId}`);
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export type CourseFormInput = {
  phaseId: string;
  levelId: string | null;
  title: string;
  description: string;
  thumbnailUrl: string;
  displayOrder: number;
};

export async function createCourse(input: CourseFormInput): Promise<CreateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_content")
    .insert({
      phase_id: input.phaseId,
      level_id: input.levelId,
      title: input.title,
      description: input.description || null,
      thumbnail_url: input.thumbnailUrl || null,
      display_order: input.displayOrder,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create course." };
  revalidateContent();
  return { ok: true, id: data.id };
}

export async function updateCourse(courseId: string, input: CourseFormInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_content")
    .update({
      phase_id: input.phaseId,
      level_id: input.levelId,
      title: input.title,
      description: input.description || null,
      thumbnail_url: input.thumbnailUrl || null,
      display_order: input.displayOrder,
    })
    .eq("id", courseId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

export async function setCourseStatus(courseId: string, status: ContentStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("course_content").update({ status }).eq("id", courseId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

export async function setCourseActive(courseId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_content")
    .update({ is_active: isActive })
    .eq("id", courseId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

export type WeekFormInput = {
  weekNumber: number;
  title: string;
  description: string;
  displayOrder: number;
};

export async function createWeek(
  courseId: string,
  input: WeekFormInput
): Promise<CreateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_weeks")
    .insert({
      course_id: courseId,
      week_number: input.weekNumber,
      title: input.title,
      description: input.description || null,
      display_order: input.displayOrder,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create week." };
  revalidateContent(courseId);
  return { ok: true, id: data.id };
}

export async function updateWeek(
  weekId: string,
  courseId: string,
  input: WeekFormInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_weeks")
    .update({
      week_number: input.weekNumber,
      title: input.title,
      description: input.description || null,
      display_order: input.displayOrder,
    })
    .eq("id", weekId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

export async function setWeekStatus(
  weekId: string,
  courseId: string,
  status: ContentStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("course_weeks").update({ status }).eq("id", weekId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

export async function setWeekActive(
  weekId: string,
  courseId: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_weeks")
    .update({ is_active: isActive })
    .eq("id", weekId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export type LessonFormInput = {
  title: string;
  description: string;
  notes: string;
  videoUrl: string;
  videoProvider: string;
  displayOrder: number;
};

export async function createLesson(
  weekId: string,
  courseId: string,
  input: LessonFormInput
): Promise<CreateResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_lessons")
    .insert({
      week_id: weekId,
      title: input.title,
      description: input.description || null,
      notes: input.notes || null,
      video_url: input.videoUrl || null,
      video_provider: input.videoProvider || null,
      display_order: input.displayOrder,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create lesson." };
  revalidateContent(courseId);
  return { ok: true, id: data.id };
}

export async function updateLesson(
  lessonId: string,
  courseId: string,
  input: LessonFormInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_lessons")
    .update({
      title: input.title,
      description: input.description || null,
      notes: input.notes || null,
      video_url: input.videoUrl || null,
      video_provider: input.videoProvider || null,
      display_order: input.displayOrder,
    })
    .eq("id", lessonId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

export async function setLessonStatus(
  lessonId: string,
  courseId: string,
  status: ContentStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("course_lessons").update({ status }).eq("id", lessonId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

export async function setLessonActive(
  lessonId: string,
  courseId: string,
  isActive: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_lessons")
    .update({ is_active: isActive })
    .eq("id", lessonId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export async function createResource(
  lessonId: string,
  courseId: string,
  input: { title: string; storagePath: string; displayOrder: number }
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_resources").insert({
    lesson_id: lessonId,
    title: input.title,
    storage_path: input.storagePath,
    display_order: input.displayOrder,
  });

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

export async function renameResource(
  resourceId: string,
  courseId: string,
  title: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_resources").update({ title }).eq("id", resourceId);

  if (error) return { ok: false, error: error.message };
  revalidateContent(courseId);
  return { ok: true };
}

export async function removeResource(
  resourceId: string,
  courseId: string,
  storagePath: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_resources").delete().eq("id", resourceId);

  if (error) return { ok: false, error: error.message };

  // Best-effort — the DB row (the thing RLS/access-control actually cares
  // about) is already gone even if this fails; don't fail the action over
  // an orphaned storage object.
  await supabase.storage.from("lesson-resources").remove([storagePath]);

  revalidateContent(courseId);
  return { ok: true };
}
