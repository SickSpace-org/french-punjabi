import { ExternalLink, Video } from "lucide-react";
import type { CurrentBatchRecording } from "@/lib/student/getCurrentBatch";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-CA", { dateStyle: "medium" });
}

/** Read-only — recordings/links are added by the batch's teacher (see the Teacher Portal dashboard); a student never edits this. */
export default function ClassRecordingsList({ recordings }: { recordings: CurrentBatchRecording[] }) {
  if (recordings.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Class Recordings</p>
      <div className="mt-3 space-y-2">
        {recordings.map((recording) => (
          <div key={recording.id} className="rounded-xl border border-navy/10 px-4 py-2.5">
            <a
              href={recording.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-dark hover:underline"
            >
              <Video className="h-4 w-4 shrink-0" strokeWidth={2} />
              {recording.title || "Recording"}
              <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={2} />
            </a>
            <p className="mt-0.5 text-xs text-navy/45">
              {recording.classDate ? `Class of ${formatDate(recording.classDate)} — ` : ""}
              Given by {recording.teacherName}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
