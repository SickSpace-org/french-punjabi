import type { NextRequest } from "next/server";
import { createViewUrl, ResourcesStorageUnavailableError } from "@/lib/r2/resources";
import { getPublishedObjectKey } from "@/lib/resources/queries";
import { SLUG_PATTERN, SIGNED_GET_TTL_SECONDS } from "@/lib/resources/config";
import { noStoreJson, notFoundJson, unavailableJson } from "@/lib/resources/apiResponse";

export const dynamic = "force-dynamic";

/**
 * PUBLIC (no login, by design). Returns a ~120 s signed GET URL for a
 * published resource's file, and nothing else — never an object key or
 * bucket name as a field. The database is read on every call (no caching),
 * so unpublishing or deleting stops new URLs immediately; a URL already
 * issued dies within SIGNED_GET_TTL_SECONDS.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) return notFoundJson();

  const lookup = await getPublishedObjectKey(slug);
  if (lookup.state === "unavailable") return unavailableJson();
  if (lookup.state === "not_found") return notFoundJson();

  try {
    const url = await createViewUrl(lookup.value);
    return noStoreJson({ url, expiresInSeconds: SIGNED_GET_TTL_SECONDS });
  } catch (error) {
    if (!(error instanceof ResourcesStorageUnavailableError)) {
      console.error("[Resources] signing failed:", error instanceof Error ? error.message : error);
    }
    return unavailableJson();
  }
}
