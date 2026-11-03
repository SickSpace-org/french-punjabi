import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import {
  deleteObject,
  headObject,
  readFirstBytes,
  ResourcesStorageUnavailableError,
} from "@/lib/r2/resources";
import { getResourceKeys } from "@/lib/resources/queries";
import { verifyUploadedPdf } from "@/lib/resources/verifyUpload";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  forbiddenJson,
  noStoreJson,
  notFoundJson,
  unavailableJson,
} from "@/lib/resources/apiResponse";
import { getMaxUploadBytes } from "@/lib/resources/config";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function safeFileName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Display-only. Strip control characters and any path, cap the length.
  const name = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[\\/]/)
    .pop()
    ?.trim();
  return name ? name.slice(0, 200) : null;
}

/**
 * Step 2 of an upload. Takes NO object key from the client: it verifies the
 * pending key stored on the row — size within the cap, starts with "%PDF-" —
 * and only then moves it to object_key ("ready"). One HEAD and one 5-byte
 * ranged read; no file is downloaded or processed here. Body: { name?: string }.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return forbiddenJson();
  const { id } = await params;
  if (!UUID.test(id)) return notFoundJson();

  let name: string | null = null;
  try {
    const body = (await request.json()) as { name?: unknown };
    name = safeFileName(body.name);
  } catch {
    // name is optional
  }

  const keys = await getResourceKeys(id);
  if (keys.state === "unavailable") return unavailableJson();
  if (keys.state === "not_found") return notFoundJson();

  const pending = keys.value.pendingObjectKey;
  if (!pending) {
    return noStoreJson({ error: "There is no upload waiting to be finished. Please upload the file again." }, 409);
  }

  try {
    const verdict = await verifyUploadedPdf({ head: headObject, readFirstBytes }, pending, getMaxUploadBytes());

    if (!verdict.ok) {
      // A bad file must not linger: remove it and clear the pending marker. A previously ready file is untouched.
      if (verdict.reason !== "missing") await deleteObject(pending).catch(() => {});
      await createAdminClient()
        .from("resources")
        .update({ pending_object_key: null })
        .eq("id", id)
        .eq("pending_object_key", pending);
      return noStoreJson({ error: verdict.message }, verdict.reason === "missing" ? 409 : 422);
    }

    // Compare-and-set on the pending key: a second tab or a retry can't promote the same file twice.
    const { data, error } = await createAdminClient()
      .from("resources")
      .update({
        object_key: pending,
        pending_object_key: null,
        size_bytes: verdict.size,
        original_name: name,
      })
      .eq("id", id)
      .eq("pending_object_key", pending)
      .select("id");

    if (error) {
      console.error("[Resources] finalize update failed:", error.message);
      return unavailableJson();
    }
    if (!data || data.length === 0) {
      return noStoreJson({ error: "This upload was replaced by a newer one. Please try again." }, 409);
    }

    // The file this one replaced is now unreferenced: remove it (best effort).
    const previous = keys.value.objectKey;
    if (previous && previous !== pending) deleteObject(previous).catch(() => {});

    revalidatePath("/admin/resources");
    revalidatePath("/resources");
    revalidatePath("/resources/[slug]", "page");
    return noStoreJson({ ok: true, size: verdict.size });
  } catch (error) {
    if (!(error instanceof ResourcesStorageUnavailableError)) {
      console.error("[Resources] finalize failed:", error instanceof Error ? error.message : error);
    }
    return unavailableJson();
  }
}
