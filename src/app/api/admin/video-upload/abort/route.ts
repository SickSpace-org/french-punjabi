import { NextResponse, type NextRequest } from "next/server";
import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2/server";
import { badRequest, requireAdmin, unauthorized } from "../_shared";

/** Cancels an in-progress multipart upload (user hit Cancel, or a part
 * failed past retries) so R2 doesn't keep billing for the abandoned parts.
 * Best-effort from the caller's side — always returns ok so a cleanup
 * failure never blocks the UI from resetting. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();

  const { key, uploadId } = await request.json();
  if (!key || !uploadId) return badRequest("key and uploadId are required.");

  try {
    await getR2Client().send(
      new AbortMultipartUploadCommand({ Bucket: getR2BucketName(), Key: key, UploadId: uploadId })
    );
  } catch (error) {
    console.error("R2 abort multipart upload failed", error);
  }
  return NextResponse.json({ ok: true });
}
