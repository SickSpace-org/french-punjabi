import { FileText } from "lucide-react";
import type { CurrentBatchMaterial } from "@/lib/student/getCurrentBatch";

/** Read-only — materials are uploaded by the batch's teacher (see the Teacher Portal dashboard); a student never edits this. */
export default function BatchMaterialsList({ materials }: { materials: CurrentBatchMaterial[] }) {
  if (materials.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Materials</p>
      <div className="mt-3 space-y-2">
        {materials.map((material) => (
          <div key={material.id} className="rounded-xl border border-navy/10 px-4 py-2.5">
            {material.downloadUrl ? (
              <a
                href={material.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-dark hover:underline"
              >
                <FileText className="h-4 w-4 shrink-0" strokeWidth={2} />
                {material.title}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/50">
                <FileText className="h-4 w-4 shrink-0" strokeWidth={2} />
                {material.title} (link unavailable)
              </span>
            )}
            <p className="mt-0.5 text-xs text-navy/45">Shared by {material.teacherName}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
