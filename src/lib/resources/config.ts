/**
 * Shared constants for the public Resources feature. No secrets and no
 * server-only imports, so this is safe to import from client components.
 */

export const DEFAULT_MAX_UPLOAD_MB = 8;
/** Hard ceiling in code: a mistyped RESOURCES_MAX_UPLOAD_MB can never exceed this. */
export const MAX_UPLOAD_MB_CEILING = 50;

/** How long a signed GET URL for the viewer stays valid. The viewer
 * downloads the whole file once, so this only has to cover that one fetch. */
export const SIGNED_GET_TTL_SECONDS = 120;
/** How long the admin has to finish the browser → R2 upload after the
 * presigned PUT URL is issued. */
export const SIGNED_PUT_TTL_SECONDS = 10 * 60;

export const OBJECT_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const CATEGORY_SUGGESTIONS = [
  "Grammar",
  "Vocabulary",
  "Reading",
  "Writing",
  "Listening",
  "Speaking",
  "TEF / TCF practice",
];

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;
export const CATEGORY_MAX = 60;

/** Pure so it can be unit-tested: parses the env value, falling back to the
 * default for anything missing, non-numeric or non-positive, and clamping to
 * the hard ceiling. */
export function parseMaxUploadMb(raw: string | undefined): number {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_UPLOAD_MB;
  return Math.min(n, MAX_UPLOAD_MB_CEILING);
}

export function getMaxUploadBytes(): number {
  return Math.floor(parseMaxUploadMb(process.env.RESOURCES_MAX_UPLOAD_MB) * 1024 * 1024);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Slug from a title: lower-case ASCII, accents stripped, words joined by "-". */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
  return base || "resource";
}
