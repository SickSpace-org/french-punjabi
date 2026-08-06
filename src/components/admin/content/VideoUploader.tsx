"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Play, Upload, X } from "lucide-react";
import { useToast } from "@/components/admin/ToastProvider";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB — S3/R2 multipart parts must be >=5MB except the last.
const PART_RETRY_DELAYS = [0, 2000, 5000, 10000];

type CompletedPart = { partNumber: number; etag: string };

class UploadCancelledError extends Error {}

/** A tiny fetch wrapper for the JSON control-plane calls (start/part-url/
 * complete/abort/delete) — the actual video bytes never go through these,
 * only small JSON bodies asking R2 for a presigned URL or confirming a
 * step, which is why none of this is limited by Vercel's function body
 * size caps. */
async function callUploadApi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/admin/video-upload/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const status = res.status;
    const err = new Error(`Request to ${path} failed with status ${status}`) as Error & {
      status?: number;
    };
    err.status = status;
    throw err;
  }
  return res.json();
}

/** PUTs one chunk directly to R2 using a presigned URL, reporting byte
 * progress via XHR (fetch doesn't expose upload progress). Resolves with
 * the part's ETag header, which CompleteMultipartUpload needs verbatim
 * (quotes included) to identify the part. */
function uploadPart(
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
  registerXhr: (xhr: XMLHttpRequest | null) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    registerXhr(xhr);
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      registerXhr(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(
            new Error(
              "R2 didn't return an ETag for this part — the bucket's CORS policy likely needs ExposeHeaders: [\"ETag\"]."
            )
          );
          return;
        }
        resolve(etag);
      } else {
        const err = new Error(`Chunk upload failed with status ${xhr.status}`) as Error & {
          status?: number;
        };
        err.status = xhr.status;
        reject(err);
      }
    };
    xhr.onerror = () => {
      registerXhr(null);
      reject(new Error("Network error while uploading a chunk."));
    };
    xhr.onabort = () => {
      registerXhr(null);
      reject(new UploadCancelledError());
    };
    xhr.send(blob);
  });
}

function describeUploadError(error: unknown): string {
  if (error instanceof UploadCancelledError) return "Upload cancelled.";
  const status = (error as { status?: number } | undefined)?.status;
  switch (status) {
    case 403:
      return "Your session expired — please sign in again and retry.";
    case 413:
      return "This file is larger than the server currently allows.";
    default:
      return "Video upload failed. Please try again.";
  }
}

/**
 * Uploads a video straight to Cloudflare R2 using the S3 multipart API: the
 * server only ever mints short-lived presigned URLs (see
 * src/app/api/admin/video-upload/*), the actual bytes go browser → R2
 * directly. That's what makes multi-GB, hour-long recordings possible
 * despite Vercel Functions' request body limits — no video data ever
 * passes through a Next.js route.
 */
export default function VideoUploader({
  courseId,
  lessonId,
  onUploaded,
}: {
  courseId: string;
  lessonId: string;
  onUploaded: (videoKey: string, fileName: string) => void;
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentXhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string; fileName: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // The blob URL only exists in this tab's memory — revoke it whenever it's
  // replaced or the component unmounts so we don't leak memory across
  // repeated uploads in one session.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  // Warn before an accidental tab close/refresh — a real risk on an
  // hour-long upload that can run for tens of minutes on a slow connection.
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
    cancelledRef.current = false;
    setProgress(0);
    setPreview(null);
    setIsPlaying(false);

    let key: string | undefined;
    let uploadId: string | undefined;

    try {
      const started = await callUploadApi<{ key: string; uploadId: string }>("start", {
        courseId,
        lessonId,
        fileName: file.name,
        contentType: file.type || "video/mp4",
      });
      key = started.key;
      uploadId = started.uploadId;

      const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      const parts: CompletedPart[] = [];
      const partBytesLoaded = new Array<number>(totalParts + 1).fill(0);

      const reportProgress = () => {
        const loaded = partBytesLoaded.reduce((sum, n) => sum + n, 0);
        setProgress(Math.min(99, Math.round((loaded / file.size) * 100)));
      };

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (cancelledRef.current) throw new UploadCancelledError();

        const start = (partNumber - 1) * CHUNK_SIZE;
        const blob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));

        let lastError: unknown;
        let etag: string | null = null;

        for (let attempt = 0; attempt < PART_RETRY_DELAYS.length; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, PART_RETRY_DELAYS[attempt]));
          }
          if (cancelledRef.current) throw new UploadCancelledError();

          try {
            const { url } = await callUploadApi<{ url: string }>("part-url", {
              key,
              uploadId,
              partNumber,
            });
            etag = await uploadPart(
              url,
              blob,
              (loaded) => {
                partBytesLoaded[partNumber] = loaded;
                reportProgress();
              },
              (xhr) => {
                currentXhrRef.current = xhr;
              }
            );
            lastError = null;
            break;
          } catch (err) {
            if (err instanceof UploadCancelledError) throw err;
            lastError = err;
          }
        }

        if (!etag) throw lastError ?? new Error("Chunk upload failed after retries.");

        partBytesLoaded[partNumber] = blob.size;
        parts.push({ partNumber, etag });
      }

      await callUploadApi("complete", { key, uploadId, parts });

      setProgress(null);
      setPreview({ url: URL.createObjectURL(file), fileName: file.name });
      onUploaded(key, file.name);
      showToast("Video uploaded.");
    } catch (error) {
      setProgress(null);
      if (!(error instanceof UploadCancelledError)) {
        console.error(error);
        showToast(describeUploadError(error), "error");
      }
      if (key && uploadId) {
        callUploadApi("abort", { key, uploadId }).catch(() => {});
      }
    }
  };

  const cancelUpload = () => {
    cancelledRef.current = true;
    currentXhrRef.current?.abort();
    currentXhrRef.current = null;
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

      {preview && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Video has been uploaded
            <span className="font-normal text-green-700/70">— {preview.fileName}</span>
          </p>
          <div className="relative mt-1.5 overflow-hidden rounded-xl border border-navy/10 bg-black">
            <video
              ref={previewVideoRef}
              src={preview.url}
              controls={isPlaying}
              preload="metadata"
              playsInline
              className="w-full"
              onClick={() => {
                if (isPlaying) return;
                setIsPlaying(true);
                previewVideoRef.current?.play();
              }}
            />
            {!isPlaying && (
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(true);
                  previewVideoRef.current?.play();
                }}
                aria-label="Play video"
                className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/35"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <Play className="ml-0.5 h-6 w-6 text-navy" fill="currentColor" strokeWidth={0} />
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
