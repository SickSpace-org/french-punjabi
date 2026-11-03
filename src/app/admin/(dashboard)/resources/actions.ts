"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject, isResourcesStorageConfigured } from "@/lib/r2/resources";
import { getResourceKeys } from "@/lib/resources/queries";
import { CATEGORY_MAX, DESCRIPTION_MAX, TITLE_MAX, slugify } from "@/lib/resources/config";
import { isMissingTableError } from "@/lib/resources/errors";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

export type ResourceFormInput = {
  title: string;
  description: string;
  category: string;
  displayOrder: number;
};

const NOT_AUTHORIZED = "Your session expired. Please sign in again.";
const TABLE_MISSING = "The resources table doesn't exist yet. Run supabase/063_public_resources.sql first.";

/** Every action below calls requireAdmin() first: these write through the
 * service-role client, which bypasses RLS, so this check IS the authorization. */

function revalidateResources() {
  revalidatePath("/admin/resources");
  revalidatePath("/resources");
  revalidatePath("/resources/[slug]", "page");
  revalidatePath("/sitemap.xml");
}

function clean(input: ResourceFormInput):
  | { ok: true; value: ResourceFormInput }
  | { ok: false; error: string } {
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

export async function createResource(input: ResourceFormInput): Promise<CreateResult> {
  if (!(await requireAdmin())) return { ok: false, error: NOT_AUTHORIZED };
  const cleaned = clean(input);
  if (!cleaned.ok) return cleaned;
  const { title, description, category, displayOrder } = cleaned.value;

  const supabase = createAdminClient();
  const base = slugify(title);
  for (let attempt = 1; attempt <= 25; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const { data, error } = await supabase
      .from("resources")
      .insert({ slug, title, description, category, display_order: displayOrder })
      .select("id")
      .single();

    if (!error && data) {
      revalidateResources();
      return { ok: true, id: data.id };
    }
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

  // The slug is deliberately never changed after creation, so published URLs stay stable.
  const { error } = await createAdminClient()
    .from("resources")
    .update({ title, description, category, display_order: displayOrder })
    .eq("id", id);

  if (error) {
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
    // 23514 = the "published only when a file is ready" CHECK constraint.
    if (error.code === "23514") return { ok: false, error: "Upload a PDF before publishing this resource." };
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
