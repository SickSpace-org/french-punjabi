/**
 * The ONLY shape in which a resource leaves the server for a public page.
 * Pure so a unit test can prove it never carries an object key — and that a
 * video carries only URLs built from its validated ID, never the pasted link.
 */

import { isValidVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from "./youtube.ts";

export type ResourceType = "pdf" | "youtube";

/** Server-built links for a video resource. */
export type PublicVideo = {
  watchUrl: string;
  thumbnailUrl: string;
};

export type PublicResource = {
  slug: string;
  title: string;
  description: string;
  category: string;
  type: ResourceType;
  sizeBytes: number | null;
  updatedAt: string;
  /** Present only for type "youtube". */
  video: PublicVideo | null;
};

/** Columns that exist before migration 064. */
export const LEGACY_PUBLIC_COLUMNS = "slug, title, description, category, size_bytes, updated_at, display_order";

/** The columns the public pages select — deliberately excludes object_key and pending_object_key. */
export const PUBLIC_COLUMNS = `${LEGACY_PUBLIC_COLUMNS}, resource_type, youtube_video_id`;

export type PublicRow = {
  slug: string;
  title: string;
  description: string;
  category: string;
  size_bytes: number | null;
  updated_at: string;
  display_order: number;
  /** Absent (undefined) until migration 064 is applied: such rows are PDFs. */
  resource_type?: string | null;
  youtube_video_id?: string | null;
};

/**
 * Builds the projection field by field, so extra columns on `row` (e.g. a stray object_key) can never leak through.
 * Returns null for a video row whose stored ID is not a valid video ID, so a broken row is skipped rather than rendered.
 */
export function toPublic(row: PublicRow): PublicResource | null {
  const base = {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    updatedAt: row.updated_at,
  };

  if (row.resource_type === "youtube") {
    if (!isValidVideoId(row.youtube_video_id)) return null;
    return {
      ...base,
      type: "youtube",
      sizeBytes: null,
      video: {
        watchUrl: youtubeWatchUrl(row.youtube_video_id),
        thumbnailUrl: youtubeThumbnailUrl(row.youtube_video_id),
      },
    };
  }

  return { ...base, type: "pdf", sizeBytes: row.size_bytes, video: null };
}
