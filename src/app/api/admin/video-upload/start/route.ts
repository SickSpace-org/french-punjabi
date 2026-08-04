import { NextResponse, type NextRequest } from "next/server";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { buildVideoKey, getR2BucketName, getR2Client } from "@/lib/r2/server";
import { badRequest, requireAdmin, serverError, unauthorized } from "../_shared";

/** Starts a multipart upload and returns the object key + uploadId the
 * client will use for every subsequent part-url/list-parts/complete call. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();

  const { courseId, lessonId, fileName, contentType } = await request.json();
  if (!courseId || !lessonId || !fileName) {
    return badRequest("courseId, lessonId, and fileName are required.");
  }

  const key = buildVideoKey(courseId, lessonId, fileName);

  try {
    const result = await getR2Client().send(
      new CreateMultipartUploadCommand({
        Bucket: getR2BucketName(),
        Key: key,
        ContentType: contentType || "video/mp4",
      })
    );

    if (!result.UploadId) return serverError("R2 did not return an upload id.");
    return NextResponse.json({ key, uploadId: result.UploadId });
  } catch (error) {
    console.error("R2 create multipart upload failed", error);
    return serverError("Unable to start the upload.");
  }
}
