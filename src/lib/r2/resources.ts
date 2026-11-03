import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SIGNED_GET_TTL_SECONDS, SIGNED_PUT_TTL_SECONDS } from "@/lib/resources/config";

/**
 * R2 access for the public Resources feature, in a NEW private bucket
 * (R2_RESOURCES_BUCKET_NAME). Deliberately separate from the lesson-video
 * helpers in ./server.ts, which are untouched: those return a *public* URL
 * when R2_PUBLIC_URL is set and sign for 6 hours, neither of which is
 * acceptable here. This file never honours R2_PUBLIC_URL.
 *
 * It builds its own S3 client (same credentials/endpoint env vars as the
 * video client) because presigned PUT URLs must be made with
 * requestChecksumCalculation: "WHEN_REQUIRED". The SDK's default adds an
 * x-amz-checksum-crc32 query parameter computed over an empty body to every
 * presigned PUT, and a browser upload of a real file then fails the checksum.
 */

/** Thrown when the bucket, credentials or endpoint are not configured. Callers map it to a soft "unavailable". */
export class ResourcesStorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourcesStorageUnavailableError";
  }
}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;

  const endpoint =
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new ResourcesStorageUnavailableError("R2 credentials/endpoint are not configured.");
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cachedClient;
}

function getBucket(): string {
  const bucket = process.env.R2_RESOURCES_BUCKET_NAME;
  if (!bucket) throw new ResourcesStorageUnavailableError("R2_RESOURCES_BUCKET_NAME is not set.");
  return bucket;
}

/** True when the server has everything needed to talk to the resources bucket. Does not contact R2. */
export function isResourcesStorageConfigured(): boolean {
  try {
    getClient();
    getBucket();
    return true;
  } catch {
    return false;
  }
}

/**
 * A presigned PUT for one object. Content-Type and the exact Content-Length
 * are part of the signature, so R2 rejects an upload whose size differs from
 * what was declared (and validated against the cap) when the URL was issued.
 * The finalize step re-checks the stored size and is the authoritative check.
 */
export async function createUploadUrl(key: string, sizeBytes: number): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ContentType: "application/pdf",
      ContentLength: sizeBytes,
    }),
    {
      expiresIn: SIGNED_PUT_TTL_SECONDS,
      signableHeaders: new Set(["content-type", "content-length"]),
    }
  );
}

/** A short-lived signed GET URL that serves the object inline as a PDF, uncached. */
export async function createViewUrl(key: string): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: "inline",
      ResponseCacheControl: "no-store",
    }),
    { expiresIn: SIGNED_GET_TTL_SECONDS }
  );
}

/** Size of the stored object, or null if it does not exist. */
export async function headObject(key: string): Promise<{ size: number } | null> {
  try {
    const res = await getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return { size: res.ContentLength ?? 0 };
  } catch (error) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

/** The first `count` bytes of the object (a ranged read, a few bytes over the wire). */
export async function readFirstBytes(key: string, count: number): Promise<Uint8Array> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key, Range: `bytes=0-${count - 1}` })
  );
  if (!res.Body) return new Uint8Array();
  return res.Body.transformToByteArray();
}

/** Idempotent: deleting an object that does not exist succeeds. */
export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
