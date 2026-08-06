import { NextResponse, type NextRequest } from "next/server";
import { resolveR2PlaybackUrl } from "@/lib/r2/server";
import { createClient } from "@/lib/supabase/server";
import { badRequest, requireAdmin, serverError, unauthorized } from "../_shared";

/** Mints a playback URL for a lesson's already-uploaded video so the admin
 * can preview it when reopening the edit form — same two providers
 * getStudentLessonDetail resolves (see src/lib/student/getLessonDetail.ts):
 * "r2" for the current Cloudflare bucket, "upload" for lessons uploaded
 * before the R2 migration and still sitting in Supabase Storage. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return unauthorized();

  const { key, provider } = await request.json();
  if (!key || !provider) return badRequest("key and provider are required.");

  try {
    if (provider === "r2") {
      const url = await resolveR2PlaybackUrl(key);
      return NextResponse.json({ url });
    }

    if (provider === "upload") {
      const supabase = await createClient();
      const { data, error } = await supabase.storage
        .from("lesson-videos")
        .createSignedUrl(key, 6 * 60 * 60);
      if (error || !data) return serverError("Unable to sign the video URL.");
      return NextResponse.json({ url: data.signedUrl });
    }

    return badRequest("Unsupported provider.");
  } catch (error) {
    console.error("Resolving admin video playback URL failed", error);
    return serverError("Unable to resolve the video URL.");
  }
}
