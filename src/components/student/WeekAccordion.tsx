"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronRight, Circle } from "lucide-react";
import type { StudentWeekSummary } from "@/lib/student/getCourseDetail";

export default function WeekAccordion({
  courseId,
  weeks,
}: {
  courseId: string;
  weeks: StudentWeekSummary[];
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (weekId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {weeks.map((week) => {
        const expanded = !collapsed.has(week.id);
        return (
          <div key={week.id} className="overflow-hidden rounded-2xl border border-navy/10 bg-white">
            <button
              type="button"
              onClick={() => toggle(week.id)}
              className="flex w-full items-center gap-2.5 px-5 py-4 text-left"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-navy/40" strokeWidth={2} />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-navy/40" strokeWidth={2} />
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-red">
                  Week {week.weekNumber}
                </p>
                <p className="font-display text-base font-bold text-navy">{week.title}</p>
              </div>
            </button>

            {expanded ? (
              <div className="space-y-1 border-t border-navy/8 px-3 pb-3 pt-2">
                {week.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/student/courses/${courseId}/lessons/${lesson.id}`}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-navy/80 transition-colors hover:bg-cream-dim"
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-navy/25" strokeWidth={2} />
                    )}
                    {lesson.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
