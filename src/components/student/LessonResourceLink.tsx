"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { getResourceSignedUrl } from "@/app/student/actions";
import { useToast } from "@/components/admin/ToastProvider";

export default function LessonResourceLink({ resourceId, title }: { resourceId: string; title: string }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const result = await getResourceSignedUrl(resourceId);
    setLoading(false);
    if (result.ok) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      showToast(result.error, "error");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center gap-2.5 rounded-xl border border-navy/10 bg-white px-4 py-3 text-left text-sm font-medium text-navy transition-colors hover:border-red/30 hover:text-red-dark disabled:opacity-60"
    >
      <FileText className="h-4 w-4 shrink-0 text-navy/40" strokeWidth={2} />
      {loading ? "Opening…" : title}
    </button>
  );
}
