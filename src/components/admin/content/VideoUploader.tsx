"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { DetailedError, Upload as TusUpload } from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/admin/ToastProvider";

/** Path convention {courseId}/{lessonId}/{filename} — storage RLS keys off
 * the first path segment (see supabase/012_lesson_videos_storage.sql). */
function buildStoragePath(courseId: string, lessonId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${courseId}/${lessonId}/${Date.now()}-${safeName}`;
}

/** Turns a tus DetailedError into an actionable message instead of a bare
 * "please try again" — the status code usually points straight at the fix. */
function describeUploadError(error: Error | DetailedError): string {
  const status = error instanceof DetailedError ? error.originalResponse?.getStatus() : undefined;
  switch (status) {
    case 401:
    case 403:
      return "Your session expired mid-upload — please sign in again and retry.";
    case 413:
      return "This file is larger than the server currently allows. Ask an admin to raise the Supabase project's Storage upload size limit.";
    case 404:
      return "The video storage bucket wasn't found. Check that the lesson-videos bucket migration has been applied.";
    default:
      return "Video upload failed. Please try again.";
  }
}

/**
 * Resumable (TUS) upload straight to the private lesson-videos bucket.
 * A plain single-request upload isn't reliable for GB-scale, hour-long
 * recordings — this uploads in 6MB chunks and can pick back up after a
 * dropped connection instead of restarting from zero.
 */
export default function VideoUploader({
  courseId,
  lessonId,
  onUploaded,
}: {
  courseId: string;
  lessonId: string;
  onUploaded: (storagePath: string, fileName: string) => void;
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<TusUpload | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Warn before an accidental tab close/refresh — a real risk on an hour-long
  // upload that can run for tens of minutes on a typical home connection.
  useEffect(() => {
    if (progress === null) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [progress]);

  const handleFile = async (file: File) => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      showToast("Your session expired — please sign in again.", "error");
      return;
    }

    const storagePath = buildStoragePath(courseId, lessonId, file.name);
    setProgress(0);

    const upload = new TusUpload(file, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      // A 1hr recording can take well over an hour to upload on a slow
      // connection, so we retry generously with a long final backoff instead
      // of giving up after a couple of transient network blips.
      retryDelays: [0, 3000, 5000, 10000, 20000, 30000, 60000],
      // Every request (the initial POST and each PATCH chunk) re-fetches the
      // session here instead of capturing one access_token up front — a
      // multi-hour upload will otherwise outlive the ~1hr JWT expiry and start
      // failing partway through with 401s that the default retry logic won't
      // even retry (see onShouldRetry below).
      onBeforeRequest: async (req) => {
        const {
          data: { session: freshSession },
        } = await supabase.auth.getSession();
        if (freshSession) {
          req.setHeader("authorization", `Bearer ${freshSession.access_token}`);
        }
      },
      // Also retry a 401 once the header above has had a chance to refresh —
      // tus-js-client's default onShouldRetry treats all 4xx (other than
      // 409/423) as permanent failures, which would otherwise abort the whole
      // upload instead of resuming with the refreshed token.
      onShouldRetry: (error, retryAttempt, options) => {
        const status = error.originalResponse?.getStatus();
        if (status === 401) return retryAttempt < options.retryDelays!.length;
        return (!status || status < 400 || status >= 500 || status === 409 || status === 423);
      },
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: "lesson-videos",
        objectName: storagePath,
        contentType: file.type || "video/mp4",
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => {
        setProgress(null);
        showToast(describeUploadError(error), "error");
        console.error(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        setProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => {
        setProgress(null);
        onUploaded(storagePath, file.name);
        showToast("Video uploaded.");
      },
    });

    uploadRef.current = upload;
    const previousUploads = await upload.findPreviousUploads();
    if (previousUploads.length > 0) {
      upload.resumeFromPreviousUpload(previousUploads[0]);
    }
    upload.start();
  };

  const cancelUpload = () => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    setProgress(null);
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {progress === null ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy/20 px-3.5 py-2 text-xs font-semibold text-navy/60 hover:border-red/30 hover:text-red"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          Upload Video File
        </button>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-navy/10">
            <div
              className="h-full rounded-full bg-red transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-9 text-xs font-semibold text-navy/60">{progress}%</span>
          <button
            type="button"
            onClick={cancelUpload}
            aria-label="Cancel upload"
            className="rounded-full p-1 text-navy/40 hover:text-red"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      <p className="mt-1.5 text-[11px] text-navy/40">
        MP4, WebM, MOV, or Ogg — even 1hr+ recordings. Uploads in resumable
        chunks; keep this tab open until it finishes.
      </p>
    </div>
  );
}
