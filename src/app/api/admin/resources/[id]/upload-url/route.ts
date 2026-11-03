import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createUploadUrl, deleteObject, ResourcesStorageUnavailableError } from "@/lib/r2/resources";
import { getResourceKeys } from "@/lib/resources/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  badRequestJson,
  forbiddenJson,
  noStoreJson,
  notFoundJson,
  unavailableJson,
} from "@/lib/resources/apiResponse";
import { getMaxUploadBytes } from "@/lib/resources/config";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Step 1 of an upload: validate the declared size against the cap, pick a
 * random object name, remember it on the row as pending, and return a
 * presigned PUT URL. The file itself goes browser → R2 and never touches
 * this function. Body: { size: number }.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return forbiddenJson();
  const { id } = await params;
  if (!UUID.test(id)) return notFoundJson();

  let size: number;
  try {
    const body = (await request.json()) as { size?: unknown };
    size = Number(body.size);
  } catch {
    return badRequestJson("Invalid request.");
  }
  const max = getMaxUploadBytes();
  if (!Number.isInteger(size) || size <= 0) return badRequestJson("That file looks empty.");
  if (size > max) {
    return badRequestJson(`That file is larger than the ${Math.floor(max / (1024 * 1024))} MB limit.`);
  }

  const keys = await getResourceKeys(id);
  if (keys.state === "unavailable") return unavailableJson();
  if (keys.state === "not_found") return notFoundJson();

  const key = `${randomUUID()}.pdf`;
  try {
    const url = await createUploadUrl(key, size);

    const { error } = await createAdminClient()
      .from("resources")
      .update({ pending_object_key: key })
      .eq("id", id);
    if (error) {
      console.error("[Resources] saving pending key failed:", error.message);
      return unavailableJson();
    }

    // A previous upload that was never finalized is now orphaned: remove it (best effort).
    const previous = keys.value.pendingObjectKey;
    if (previous) deleteObject(previous).catch(() => {});

    return noStoreJson({ url, maxBytes: max });
  } catch (error) {
    if (!(error instanceof ResourcesStorageUnavailableError)) {
      console.error("[Resources] upload URL failed:", error instanceof Error ? error.message : error);
    }
    return unavailableJson();
  }
}
