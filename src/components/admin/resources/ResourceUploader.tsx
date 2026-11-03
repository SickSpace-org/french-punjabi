"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Upload, X } from "lucide-react";
import { useToast } from "@/components/admin/ToastProvider";
import { formatBytes } from "@/lib/resources/config";

class UploadCancelledError extends Error {}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** PUTs the file straight to R2 (presigned URL), reporting byte progress via XHR. */
function putFile(url: string, file: File, onProgress: (pct: number) => void, register: (xhr: XMLHttpRequest | null) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      register(null);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (status ${xhr.status}).`));
    };
    xhr.onerror = () => {
      register(null);
      reject(
        new Error(
          "The upload couldn't reach storage. Check your connection — and that the storage bucket's CORS settings allow this site."
        )
      );
    };
    xhr.onabort = () => {
      register(null);
      reject(new UploadCancelledError());
    };
    xhr.send(file);
  });
}

type Stage = "idle" | "uploading" | "verifying";

/**
 * Browser → R2 direct upload with a presigned URL, then a tiny "finalize"
 * call that makes the server verify the file (size cap, "%PDF-") before it
 * is marked ready. The PDF never passes through a Vercel function.
 */
export default function ResourceUploader({
  resourceId,
  maxBytes,
  hasFile,
  currentName,
  currentSize,
  onFinished,
}: {
  resourceId: string;
  maxBytes: number;
  hasFile: boolean;
  currentName: string | null;
  currentSize: number | null;
  onFinished: () => void;
}) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stage === "idle") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [stage]);

  const maxMb = Math.floor(maxBytes / (1024 * 1024));

  const handleFile = async (file: File) => {
    setError(null);
    cancelledRef.current = false;

    const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!looksLikePdf) return setError("Please choose a PDF file.");
    if (file.size === 0) return setError("That file is empty.");
    if (file.size > maxBytes) return setError(`That file is ${formatBytes(file.size)}. The limit is ${maxMb} MB.`);

    try {
      setStage("uploading");
      setProgress(0);
      const { url } = await postJson<{ url: string }>(`/api/admin/resources/${resourceId}/upload-url`, {
        size: file.size,
      });
      if (cancelledRef.current) throw new UploadCancelledError();

      await putFile(url, file, setProgress, (xhr) => {
        xhrRef.current = xhr;
      });

      setStage("verifying");
      await postJson(`/api/admin/resources/${resourceId}/finalize`, { name: file.name });

      showToast("PDF uploaded and verified.");
      onFinished();
    } catch (e) {
      if (!(e instanceof UploadCancelledError)) {
        setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
      }
    } finally {
      setStage("idle");
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    xhrRef.current?.abort();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {hasFile && stage === "idle" ? (
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          PDF is ready
          <span className="font-normal text-green-700/70">
            {currentName ? ` — ${currentName}` : ""}
            {currentSize ? ` (${formatBytes(currentSize)})` : ""}
          </span>
        </p>
      ) : null}

      {stage === "idle" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy/20 px-3.5 py-2 text-xs font-semibold text-navy/60 hover:border-red/30 hover:text-red"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          {hasFile ? "Replace PDF" : "Upload PDF"}
        </button>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-navy/10">
            <div
              className="h-full rounded-full bg-red transition-all"
              style={{ width: stage === "verifying" ? "100%" : `${progress}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-navy/60">
            {stage === "verifying" ? "Checking file…" : `${progress}%`}
          </span>
          {stage === "uploading" ? (
            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel upload"
              className="rounded-full p-1 text-navy/40 hover:text-red"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-red-dark">
          {error}
        </p>
      ) : null}
      <p className="mt-1.5 text-[11px] text-navy/40">
        PDF only, up to {maxMb} MB. Keep this tab open until it finishes.
      </p>
    </div>
  );
}
