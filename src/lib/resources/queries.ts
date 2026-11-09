import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingColumnError, isMissingTableError } from "./errors";
import {
  LEGACY_PUBLIC_COLUMNS,
  PUBLIC_COLUMNS,
  toPublic,
  type PublicResource,
  type PublicRow,
  type ResourceType,
} from "./projection";
import { isValidVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from "./youtube";

export type { PublicResource };

/**
 * Server-side reads for the Resources feature. Everything goes through the
 * service-role client because public.resources has no policies and no grants
 * for anon/authenticated (supabase/063_public_resources.sql).
 *
 * Every function selects an EXPLICIT column list and returns a hand-built
 * projection. object_key / pending_object_key are never selected for pages
 * or admin lists — only the two key-lookup helpers at the bottom read them,
 * and those are used by API routes that return nothing but a signed URL.
 *
 * All of it fails soft: a missing table, missing env var or database error
 * becomes { state: "unavailable" } instead of an exception. Before migration
 * 064 adds resource_type / youtube_video_id, the same reads fall back to the
 * original columns and every row is treated as a PDF.
 */

export type PublicResourcesResult =
  | { state: "ok"; resources: PublicResource[] }
  | { state: "unavailable" };

export type PublicResourceResult =
  | { state: "ok"; resource: PublicResource }
  | { state: "not_found" }
  | { state: "unavailable" };

type DbError = { code?: string; message?: string };

/** With 064: a published row is ready when a PDF has its file or a YouTube resource has its ID (the DB constraint guarantees it too). */
const READY_FILTER =
  "and(resource_type.eq.pdf,object_key.not.is.null),and(resource_type.eq.youtube,youtube_video_id.not.is.null)";

/**
 * Published, ready rows (optionally one slug), oldest-first by display order. Tries the 064 columns first and, if they don't
 * exist yet, retries with the original columns so the pages keep working (as PDF-only) until the migration is applied.
 */
async function fetchPublishedRows(slug: string | null): Promise<{ rows: PublicRow[]; error: DbError | null }> {
  const supabase = createAdminClient();

  let query = supabase.from("resources").select(PUBLIC_COLUMNS).eq("is_published", true).or(READY_FILTER);
  if (slug !== null) query = query.eq("slug", slug).limit(1);
  const first = await query
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!first.error) return { rows: first.data as unknown as PublicRow[], error: null };
  if (!isMissingColumnError(first.error)) return { rows: [], error: first.error };

  let legacy = supabase
    .from("resources")
    .select(LEGACY_PUBLIC_COLUMNS)
    .eq("is_published", true)
    .not("object_key", "is", null);
  if (slug !== null) legacy = legacy.eq("slug", slug).limit(1);
  const second = await legacy
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (second.error) return { rows: [], error: second.error };
  return { rows: second.data as unknown as PublicRow[], error: null };
}

export async function getPublishedResources(): Promise<PublicResourcesResult> {
  try {
    const { rows, error } = await fetchPublishedRows(null);
    if (error) {
      if (!isMissingTableError(error)) console.error("[Resources] list failed:", error.message);
      return { state: "unavailable" };
    }
    const resources = rows.flatMap((row) => {
      const resource = toPublic(row);
      return resource ? [resource] : [];
    });
    return { state: "ok", resources };
  } catch (error) {
    console.error("[Resources] list threw:", error instanceof Error ? error.message : error);
    return { state: "unavailable" };
  }
}

export async function getPublishedResource(slug: string): Promise<PublicResourceResult> {
  try {
    const { rows, error } = await fetchPublishedRows(slug);
    if (error) {
      if (!isMissingTableError(error)) console.error("[Resources] detail failed:", error.message);
      return { state: "unavailable" };
    }
    const resource = rows[0] ? toPublic(rows[0]) : null;
    return resource ? { state: "ok", resource } : { state: "not_found" };
  } catch (error) {
    console.error("[Resources] detail threw:", error instanceof Error ? error.message : error);
    return { state: "unavailable" };
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** What the admin list needs. Still no object keys — only whether a file exists. */
export type AdminResource = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  displayOrder: number;
  isPublished: boolean;
  type: ResourceType;
  hasFile: boolean;
  hasPendingUpload: boolean;
  originalName: string | null;
  sizeBytes: number | null;
  /** Video resources only — built server-side from the stored ID. */
  watchUrl: string | null;
  thumbnailUrl: string | null;
  updatedAt: string;
};

export type AdminResourcesResult =
  | {
      state: "ok";
      resources: AdminResource[];
      /** False until migration 064 is applied: the form then offers PDFs only. */
      youtubeSupported: boolean;
    }
  | { state: "table_missing" }
  | { state: "unavailable" };

const ADMIN_LEGACY_COLUMNS =
  "id, slug, title, description, category, display_order, is_published, object_key, pending_object_key, original_name, size_bytes, updated_at";
const ADMIN_COLUMNS = `${ADMIN_LEGACY_COLUMNS}, resource_type, youtube_video_id`;

type AdminRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  display_order: number;
  is_published: boolean;
  object_key: string | null;
  pending_object_key: string | null;
  original_name: string | null;
  size_bytes: number | null;
  updated_at: string;
  resource_type?: string | null;
  youtube_video_id?: string | null;
};

export async function getAdminResources(): Promise<AdminResourcesResult> {
  try {
    const supabase = createAdminClient();
    let youtubeSupported = true;
    const result = await supabase
      .from("resources")
      .select(ADMIN_COLUMNS)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    let data = result.data as unknown as AdminRow[] | null;
    let error: DbError | null = result.error;

    if (error && isMissingColumnError(error)) {
      youtubeSupported = false;
      const legacy = await supabase
        .from("resources")
        .select(ADMIN_LEGACY_COLUMNS)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      data = legacy.data as unknown as AdminRow[] | null;
      error = legacy.error;
    }

    if (error || !data) {
      if (error && isMissingTableError(error)) return { state: "table_missing" };
      console.error("[Resources] admin list failed:", error?.message);
      return { state: "unavailable" };
    }

    // The two keys are selected only to be collapsed to booleans below; they never leave this function.
    const resources: AdminResource[] = data.map((r) => {
      const videoId = r.resource_type === "youtube" && isValidVideoId(r.youtube_video_id) ? r.youtube_video_id : null;
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        category: r.category,
        displayOrder: r.display_order,
        isPublished: r.is_published,
        type: r.resource_type === "youtube" ? "youtube" : "pdf",
        hasFile: r.object_key !== null,
        hasPendingUpload: r.pending_object_key !== null,
        originalName: r.original_name,
        sizeBytes: r.size_bytes,
        watchUrl: videoId ? youtubeWatchUrl(videoId) : null,
        thumbnailUrl: videoId ? youtubeThumbnailUrl(videoId) : null,
        updatedAt: r.updated_at,
      };
    });
    return { state: "ok", resources, youtubeSupported };
  } catch (error) {
    console.error("[Resources] admin list threw:", error instanceof Error ? error.message : error);
    return { state: "unavailable" };
  }
}

// ---------------------------------------------------------------------------
// Key lookups — used only by API routes, which return a signed URL or a status, never a key.
// ---------------------------------------------------------------------------

export type KeyLookup<T> = { state: "ok"; value: T } | { state: "not_found" } | { state: "unavailable" };

/** Object key of a PUBLISHED resource's ready file, by slug. (A video resource has no file, so it is "not_found" here.) */
export async function getPublishedObjectKey(slug: string): Promise<KeyLookup<string>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("resources")
      .select("object_key")
      .eq("slug", slug)
      .eq("is_published", true)
      .not("object_key", "is", null)
      .maybeSingle();
    if (error) {
      if (!isMissingTableError(error)) console.error("[Resources] key lookup failed:", error.message);
      return { state: "unavailable" };
    }
    if (!data?.object_key) return { state: "not_found" };
    return { state: "ok", value: data.object_key };
  } catch (error) {
    console.error("[Resources] key lookup threw:", error instanceof Error ? error.message : error);
    return { state: "unavailable" };
  }
}

export type ResourceKeys = { objectKey: string | null; pendingObjectKey: string | null };

/** Both keys of one resource by id (admin routes and delete only). A video resource has neither, so deleting it removes only the row. */
export async function getResourceKeys(id: string): Promise<KeyLookup<ResourceKeys>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("resources")
      .select("object_key, pending_object_key")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      if (!isMissingTableError(error)) console.error("[Resources] keys lookup failed:", error.message);
      return { state: "unavailable" };
    }
    if (!data) return { state: "not_found" };
    return { state: "ok", value: { objectKey: data.object_key, pendingObjectKey: data.pending_object_key } };
  } catch (error) {
    console.error("[Resources] keys lookup threw:", error instanceof Error ? error.message : error);
    return { state: "unavailable" };
  }
}
