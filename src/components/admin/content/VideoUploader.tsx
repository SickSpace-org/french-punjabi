"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Upload as TusUpload } from "tus-js-client";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/admin/ToastProvider";

/** Path convention {courseId}/{lessonId}/{filename} — storage RLS keys off
 * the first path segment (see supabase/012_lesson_videos_storage.sql). */
function buildStoragePath(courseId: string, lessonId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${courseId}/${lessonId}/${Date.now()}-${safeName}`;
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
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
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
        showToast("Video upload failed. Please try again.", "error");
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
