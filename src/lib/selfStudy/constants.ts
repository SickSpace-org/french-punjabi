/**
 * Shared by the Self Study pages (student + admin), their server actions and
 * the cleanup job. Safe to import from client components.
 * See supabase/065_self_study.sql.
 */

export const SELF_STUDY_BUCKET = "self-study";

/** Every file and row is deleted this long after it's uploaded. */
export const SELF_STUDY_RETENTION_DAYS = 3;

/** Matches the bucket's file_size_limit. */
export const SELF_STUDY_MAX_BYTES = 25 * 1024 * 1024;

/** Voice recordings stop automatically after this long. */
export const MAX_RECORDING_SECONDS = 10 * 60;

function safeFileName(fileName: string) {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return cleaned || "file";
}

export function buildAssignmentPath(fileName: string) {
  return `assignments/${Date.now()}-${safeFileName(fileName)}`;
}

export function buildSubmissionPath(studentId: string, fileName: string) {
  return `submissions/${studentId}/${Date.now()}-${safeFileName(fileName)}`;
}

/**
 * Storage checks the upload's content type against the bucket's allowed
 * list, which has no codec parameters — "audio/webm;codecs=opus" must go up
 * as plain "audio/webm".
 */
export function baseMimeType(mimeType: string) {
  return mimeType.split(";")[0].trim().toLowerCase();
}

export function audioExtension(mimeType: string) {
  const base = baseMimeType(mimeType);
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/aac") return "m4a";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  if (base === "audio/wav" || base === "audio/x-wav") return "wav";
  return "webm";
}

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** "2 days 5 hours left", "3 hours left", "Deleting soon". */
export function formatTimeLeft(expiresAt: string, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 60 * 60 * 1000) return "Deleting soon";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days === 0) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const dayText = `${days} day${days === 1 ? "" : "s"}`;
  return remHours ? `${dayText} ${remHours} hour${remHours === 1 ? "" : "s"} left` : `${dayText} left`;
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
