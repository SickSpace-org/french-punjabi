import { NextResponse, type NextRequest } from "next/server";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2/server";
import { badRequest, requireAdmin, serverError, unauthorized } from "../_shared";

type PartInput = { partNumber: number; etag: string };

/** Finalizes a multipart upload once every part has been PUT to R2. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();

  const { key, uploadId, parts } = (await request.json()) as {
    key?: string;
    uploadId?: string;
    parts?: PartInput[];
  };
  if (!key || !uploadId || !parts?.length) {
    return badRequest("key, uploadId, and parts are required.");
  }

  try {
    await getR2Client().send(
      new CompleteMultipartUploadCommand({
        Bucket: getR2BucketName(),
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      })
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("R2 complete multipart upload failed", error);
    return serverError("Unable to finish the upload.");
  }
}
