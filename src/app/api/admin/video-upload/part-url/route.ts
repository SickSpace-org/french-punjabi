import { NextResponse, type NextRequest } from "next/server";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2BucketName, getR2Client } from "@/lib/r2/server";
import { badRequest, requireAdmin, serverError, unauthorized } from "../_shared";

/** Mints a presigned PUT URL for one part of an in-progress multipart
 * upload. The client PUTs the chunk straight to R2 with this URL — the
 * bytes never pass through this server, only the (tiny) signing request
 * does, which is what makes multi-GB uploads possible on Vercel Functions'
 * request-body limits. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();

  const { key, uploadId, partNumber } = await request.json();
  if (!key || !uploadId || !partNumber) {
    return badRequest("key, uploadId, and partNumber are required.");
  }

  try {
    const url = await getSignedUrl(
      getR2Client(),
      new UploadPartCommand({
        Bucket: getR2BucketName(),
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: 3600 }
    );
    return NextResponse.json({ url });
  } catch (error) {
    console.error("R2 presign part URL failed", error);
    return serverError("Unable to prepare the next chunk.");
  }
}
