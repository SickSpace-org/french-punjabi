import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createViewUrl, ResourcesStorageUnavailableError } from "@/lib/r2/resources";
import { getResourceKeys } from "@/lib/resources/queries";
import { forbiddenJson, noStoreJson, notFoundJson, unavailableJson } from "@/lib/resources/apiResponse";
import { SIGNED_GET_TTL_SECONDS } from "@/lib/resources/config";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Admin-only preview of a resource's ready file, published or not. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return forbiddenJson();
  const { id } = await params;
  if (!UUID.test(id)) return notFoundJson();

  const keys = await getResourceKeys(id);
  if (keys.state === "unavailable") return unavailableJson();
  if (keys.state === "not_found" || !keys.value.objectKey) return notFoundJson();

  try {
    const url = await createViewUrl(keys.value.objectKey);
    return noStoreJson({ url, expiresInSeconds: SIGNED_GET_TTL_SECONDS });
  } catch (error) {
    if (!(error instanceof ResourcesStorageUnavailableError)) {
      console.error("[Resources] admin signing failed:", error instanceof Error ? error.message : error);
    }
    return unavailableJson();
  }
}
