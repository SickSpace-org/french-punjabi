import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let cachedClient: S3Client | null = null;

/** Lazily constructs a singleton S3 client pointed at the R2 account —
 * avoids validating R2 env vars on every server import when most requests
 * never touch video upload/playback. */
export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const endpoint =
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined);
  if (!endpoint) {
    throw new Error("Missing R2_ENDPOINT (or R2_ACCOUNT_ID to derive it).");
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cachedClient;
}

export function getR2BucketName(): string {
  return requiredEnv("R2_BUCKET_NAME");
}

/** Set only if the R2 bucket has public access enabled (an r2.dev subdomain
 * or a connected custom domain) in the Cloudflare dashboard. Left unset,
 * the bucket is treated as private and playback URLs are signed on demand
 * instead — see resolveR2PlaybackUrl. */
export function getR2PublicUrlBase(): string | null {
  const base = process.env.R2_PUBLIC_URL;
  return base ? base.replace(/\/+$/, "") : null;
}

/** Builds the object key for a lesson's video, mirroring the
 * {courseId}/{lessonId}/{filename} convention used for lesson-resources and
 * the legacy Supabase-hosted lesson-videos bucket. */
export function buildVideoKey(courseId: string, lessonId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${courseId}/${lessonId}/${Date.now()}-${safeName}`;
}

/**
 * Resolves the URL a student's browser should load for an "r2"-provider
 * lesson video. Public bucket → cheap string concatenation. Private bucket
 * → a signed GET URL, minted fresh on every page load (same 6hr window as
 * the legacy Supabase-storage signed URL) so access isn't a permanent,
 * shareable link.
 */
export async function resolveR2PlaybackUrl(key: string): Promise<string> {
  const publicBase = getR2PublicUrlBase();
  if (publicBase) return `${publicBase}/${key}`;

  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: getR2BucketName(), Key: key }),
    { expiresIn: 6 * 60 * 60 }
  );
}
