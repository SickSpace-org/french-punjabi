"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject, isResourcesStorageConfigured } from "@/lib/r2/resources";
import { getResourceKeys } from "@/lib/resources/queries";
import { CATEGORY_MAX, DESCRIPTION_MAX, TITLE_MAX, slugify } from "@/lib/resources/config";
import { isMissingColumnError, isMissingTableError } from "@/lib/resources/errors";
import { parseYouTubeUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/lib/resources/youtube";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export type ResourceFormInput = {
  title: string;
  description: string;
  category: string;
  displayOrder: number;
  /** Video resources only: the pasted link. Parsed server-side to an 11-character ID and then discarded. */
  youtubeUrl?: string;
};

export type NewResourceType = "pdf" | "youtube";

export type YouTubePreviewResult =
  | { ok: true; thumbnailUrl: string; watchUrl: string }
  | { ok: false; error: string };

const NOT_AUTHORIZED = "Your session expired. Please sign in again.";
const TABLE_MISSING = "The resources table doesn't exist yet. Run supabase/063_public_resources.sql first.";
const YOUTUBE_NOT_READY = "Video links aren't set up yet. Run supabase/064_resources_youtube_links.sql first.";

/** Every action below calls requireAdmin() first: these write through the
 * service-role client, which bypasses RLS, so this check IS the authorization. */

function revalidateResources() {
  revalidatePath("/admin/resources");
  revalidatePath("/resources");
  revalidatePath("/resources/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

type CleanedFields = Pick<ResourceFormInput, "title" | "description" | "category" | "displayOrder">;

function clean(input: ResourceFormInput): { ok: true; value: CleanedFields } | { ok: false; error: string } {
  const title = input.title.trim();
  const description = input.description.trim();
  const category = input.category.trim();
  if (!title) return { ok: false, error: "A title is required." };
  if (title.length > TITLE_MAX) return { ok: false, error: `Title must be ${TITLE_MAX} characters or fewer.` };
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, error: `Description must be ${DESCRIPTION_MAX} characters or fewer.` };
  }
  if (category.length > CATEGORY_MAX) return { ok: false, error: `Category must be ${CATEGORY_MAX} characters or fewer.` };
  const displayOrder = Number.isFinite(input.displayOrder) ? Math.trunc(input.displayOrder) : 0;
  return { ok: true, value: { title, description, category, displayOrder } };
}

/** Lets the admin form show the thumbnail before saving. Never trusted by createResource/updateResource, which parse again. */
export async function previewYouTubeUrl(url: string): Promise<YouTubePreviewResult> {
  if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };
  const parsed = parseYouTubeUrl(url);
  if (!parsed.ok) return parsed;
  return { ok: true, thumbnailUrl: youtubeThumbnailUrl(parsed.videoId), watchUrl: youtubeWatchUrl(parsed.videoId) };
}

export async function createResource(input: ResourceFormInput, type: NewResourceType = "pdf"): Promise<CreateResult> {
  if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };
  if (type !== "pdf" && type !== "youtube") return { ok: false, error: "Choose PDF or YouTube link." };
  const cleaned = clean(input);
  if (!cleaned.ok) return cleaned;
  const { title, description, category, displayOrder } = cleaned.value;

  // Only the 11-character ID is kept; the pasted URL is dropped here. PDFs omit both new columns, so they still work before 064.
  let videoColumns: { resource_type: "youtube"; youtube_video_id: string } | undefined;
  if (type === "youtube") {
    const parsed = parseYouTubeUrl(input.youtubeUrl);
    if (!parsed.ok) return parsed;
    videoColumns = { resource_type: "youtube", youtube_video_id: parsed.videoId };
  }

  const supabase = createAdminClient();
  const base = slugify(title);
  for (let attempt = 1; attempt <= 25; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const { data, error } = await supabase
      .from("resources")
      .insert({ slug, title, description, category, display_order: displayOrder, ...videoColumns })
      .select("id")
      .single();

    if (!error && data) {
      revalidateResources();
      return { ok: true, id: data.id };
    }
    if (isMissingColumnError(error)) return { ok: false, error: YOUTUBE_NOT_READY };
    if (isMissingTableError(error)) return { ok: false, error: TABLE_MISSING };
    if (error?.code !== "23505") {
      console.error("[Resources] create failed:", error?.message);
      return { ok: false, error: "Couldn't create the resource. Please try again." };
    }
    // 23505 = the slug is taken: try the next suffix.
  }
  return { ok: false, error: "Couldn't find a free web address for that title. Try a different title." };
}

export async function updateResource(id: string, input: ResourceFormInput): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };
  const cleaned = clean(input);
  if (!cleaned.ok) return cleaned;
  const { title, description, category, displayOrder } = cleaned.value;

  // The slug and the resource type are deliberately never changed after creation, so published URLs stay stable.
  const fields = { title, description, category, display_order: displayOrder };
  const supabase = createAdminClient();
  const link = input.youtubeUrl?.trim();

  let error: { code?: string; message: string } | null;
  if (link) {
    // A video's link may be corrected. It is re-parsed to an ID here, and the update only matches a row that really is a video,
    // so a link can never be attached to a PDF.
    const parsed = parseYouTubeUrl(link);
    if (!parsed.ok) return parsed;
    const result = await supabase
      .from("resources")
      .update({ ...fields, youtube_video_id: parsed.videoId })
      .eq("id", id)
      .eq("resource_type", "youtube")
      .select("id");
    error = result.error;
    if (!error && (result.data?.length ?? 0) === 0) {
      return { ok: false, error: "That resource isn't a video link, so a YouTube link can't be set on it." };
    }
  } else {
    error = (await supabase.from("resources").update(fields).eq("id", id)).error;
  }

  if (error) {
    if (isMissingColumnError(error)) return { ok: false, error: YOUTUBE_NOT_READY };
    if (isMissingTableError(error)) return { ok: false, error: TABLE_MISSING };
    console.error("[Resources] update failed:", error.message);
    return { ok: false, error: "Couldn't save the changes. Please try again." };
  }
  revalidateResources();
  return { ok: true };
}

export async function setResourcePublished(id: string, published: boolean): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

  const { error } = await createAdminClient().from("resources").update({ is_published: published }).eq("id", id);
  if (error) {
    // 23514 = the "published only when ready" CHECK constraint (a PDF needs its file, a video needs its link).
    if (error.code === "23514") {
      return { ok: false, error: "This resource isn't ready to publish: a PDF needs its file uploaded." };
    }
    if (isMissingTableError(error)) return { ok: false, error: TABLE_MISSING };
    console.error("[Resources] publish toggle failed:", error.message);
    return { ok: false, error: "Couldn't update the resource. Please try again." };
  }
  revalidateResources();
  return { ok: true };
}

export async function deleteResource(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };

  const keys = await getResourceKeys(id);
  if (keys.state === "unavailable") return { ok: false, error: "Couldn't load the resource. Please try again." };
  if (keys.state === "not_found") {
    revalidateResources();
    return { ok: true };
  }

  // A video resource has no file keys, so it skips storage entirely and only the row is deleted.
  const objectKeys = [keys.value.objectKey, keys.value.pendingObjectKey].filter((k): k is string => !!k);
  if (objectKeys.length > 0) {
    // Files first, row second: if the storage delete fails the row is kept, so nothing is orphaned silently.
    if (!isResourcesStorageConfigured()) {
      return { ok: false, error: "File storage isn't configured, so the file can't be removed. Nothing was deleted." };
    }
    try {
      for (const key of objectKeys) await deleteObject(key);
    } catch (error) {
      console.error("[Resources] object delete failed:", error instanceof Error ? error.message : error);
      return { ok: false, error: "Couldn't remove the file from storage. Nothing was deleted; please try again." };
    }
  }

  const { error } = await createAdminClient().from("resources").delete().eq("id", id);
  if (error) {
    console.error("[Resources] row delete failed:", error.message);
    return { ok: false, error: "The file was removed but the entry couldn't be deleted. Please try again." };
  }
  revalidateResources();
  return { ok: true };
}
