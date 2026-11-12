/**
 * Shared by the Assignments pages (student + admin) and their server
 * actions. Safe to import from client components.
 * See supabase/066_assignments.sql.
 */

export const ASSIGNMENTS_BUCKET = "assignments";

/** Every file and row is deleted this long after it's uploaded. */
export const ASSIGNMENT_RETENTION_DAYS = 3;

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

/** Matches the bucket's file_size_limit. */
export const ASSIGNMENT_MAX_BYTES = 25 * 1024 * 1024;

function safeFileName(fileName: string) {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return cleaned || "file.pdf";
}

export function buildTaskPath(fileName: string) {
  return `tasks/${Date.now()}-${safeFileName(fileName)}`;
}

export function buildSubmissionPath(studentId: string, fileName: string) {
  return `submissions/${studentId}/${Date.now()}-${safeFileName(fileName)}`;
}

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
