import { NextResponse, type NextRequest } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2/server";
import { badRequest, requireAdmin, unauthorized } from "../_shared";

/** Deletes a previous video's R2 object — used when a lesson's video is
 * replaced with a new upload, mirroring the existing cleanup of orphaned
 * Supabase-storage objects in LessonFormModal. Best-effort: the DB row
 * (what access control actually depends on) is already updated by the time
 * this is called, so a failure here just leaves one orphaned object. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();

  const { key } = await request.json();
  if (!key) return badRequest("key is required.");

  try {
    await getR2Client().send(new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key }));
  } catch (error) {
    console.error("R2 delete object failed", error);
  }
  return NextResponse.json({ ok: true });
}
