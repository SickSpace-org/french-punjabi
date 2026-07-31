"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { markLessonComplete } from "@/app/student/actions";
import { useToast } from "@/components/admin/ToastProvider";

export default function MarkCompleteButton({
  lessonId,
  initialCompleted,
}: {
  lessonId: string;
  initialCompleted: boolean;
}) {
  const { showToast } = useToast();
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (completed) return;
    startTransition(async () => {
      const result = await markLessonComplete(lessonId);
      if (result.ok) {
        setCompleted(true);
        showToast("Lesson marked complete.");
      } else {
        showToast(result.error, "error");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={completed || pending}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide shadow-sm transition-all duration-300 disabled:cursor-default ${
        completed
          ? "bg-emerald-50 text-emerald-700"
          : "bg-navy text-white shadow-navy/20 hover:-translate-y-0.5 hover:bg-navy-dark hover:shadow-md"
      }`}
    >
      <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
      {completed ? "Completed" : pending ? "Saving…" : "Mark as Complete"}
    </button>
  );
}
