import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "./errors";
import { PUBLIC_COLUMNS, toPublic, type PublicResource, type PublicRow } from "./projection";

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
 * becomes { state: "unavailable" } instead of an exception.
 */

export type PublicResourcesResult =
  | { state: "ok"; resources: PublicResource[] }
  | { state: "unavailable" };

export type PublicResourceResult =
  | { state: "ok"; resource: PublicResource }
  | { state: "not_found" }
  | { state: "unavailable" };

export async function getPublishedResources(): Promise<PublicResourcesResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("resources")
      .select(PUBLIC_COLUMNS)
      .eq("is_published", true)
      .not("object_key", "is", null)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      if (!isMissingTableError(error)) console.error("[Resources] list failed:", error.message);
      return { state: "unavailable" };
    }
    return { state: "ok", resources: (data as PublicRow[]).map(toPublic) };
  } catch (error) {
    console.error("[Resources] list threw:", error instanceof Error ? error.message : error);
    return { state: "unavailable" };
  }
}

export async function getPublishedResource(slug: string): Promise<PublicResourceResult> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("resources")
      .select(PUBLIC_COLUMNS)
      .eq("slug", slug)
      .eq("is_published", true)
      .not("object_key", "is", null)
      .maybeSingle();

    if (error) {
      if (!isMissingTableError(error)) console.error("[Resources] detail failed:", error.message);
      return { state: "unavailable" };
    }
    if (!data) return { state: "not_found" };
    return { state: "ok", resource: toPublic(data as PublicRow) };
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
  hasFile: boolean;
  hasPendingUpload: boolean;
  originalName: string | null;
  sizeBytes: number | null;
  updatedAt: string;
};

export type AdminResourcesResult =
  | { state: "ok"; resources: AdminResource[] }
  | { state: "table_missing" }
  | { state: "unavailable" };

export async function getAdminResources(): Promise<AdminResourcesResult> {
  try {
    const supabase = createAdminClient();
    // The two keys are selected only to be collapsed to booleans below; they never leave this function.
    const { data, error } = await supabase
      .from("resources")
      .select(
        "id, slug, title, description, category, display_order, is_published, object_key, pending_object_key, original_name, size_bytes, updated_at"
      )
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      if (isMissingTableError(error)) return { state: "table_missing" };
      console.error("[Resources] admin list failed:", error.message);
      return { state: "unavailable" };
    }

    const resources: AdminResource[] = data.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      category: r.category,
      displayOrder: r.display_order,
      isPublished: r.is_published,
      hasFile: r.object_key !== null,
      hasPendingUpload: r.pending_object_key !== null,
      originalName: r.original_name,
      sizeBytes: r.size_bytes,
      updatedAt: r.updated_at,
    }));
    return { state: "ok", resources };
  } catch (error) {
    console.error("[Resources] admin list threw:", error instanceof Error ? error.message : error);
    return { state: "unavailable" };
  }
}

// ---------------------------------------------------------------------------
// Key lookups — used only by API routes, which return a signed URL or a status, never a key.
// ---------------------------------------------------------------------------

export type KeyLookup<T> = { state: "ok"; value: T } | { state: "not_found" } | { state: "unavailable" };

/** Object key of a PUBLISHED resource's ready file, by slug. */
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

/** Both keys of one resource by id (admin routes and delete only). */
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
