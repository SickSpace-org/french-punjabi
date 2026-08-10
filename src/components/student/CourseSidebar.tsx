"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, List, X } from "lucide-react";
import type { StudentWeekSummary } from "@/lib/student/getCourseDetail";

export default function CourseSidebar({
  courseId,
  courseTitle,
  weeks,
}: {
  courseId: string;
  courseTitle: string;
  weeks: StudentWeekSummary[];
}) {
  const pathname = usePathname();
  const activeLessonId = pathname.match(/\/lessons\/([^/]+)/)?.[1] ?? null;
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleWeek = (weekId: string) => {
    setCollapsedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const list = (
    <nav className="space-y-2">
      {weeks.map((week) => {
        const expanded = !collapsedWeeks.has(week.id);
        return (
          <div key={week.id} className="overflow-hidden rounded-xl border border-navy/10 bg-white">
            <button
              type="button"
              onClick={() => toggleWeek(week.id)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-navy/40" strokeWidth={2} />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-navy/40" strokeWidth={2} />
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-red">
                  Week {week.weekNumber}
                </p>
                <p className="truncate text-sm font-bold text-navy">{week.title}</p>
              </div>
            </button>

            {expanded ? (
              <div className="space-y-0.5 border-t border-navy/8 px-2 pb-2 pt-1">
                {week.lessons.map((lesson) => {
                  const active = lesson.id === activeLessonId;
                  return (
                    <Link
                      key={lesson.id}
                      href={`/student/courses/${courseId}/lessons/${lesson.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                        active ? "bg-red-soft text-red-dark" : "text-navy/75 hover:bg-cream-dim"
                      }`}
                    >
                      {lesson.completed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2} />
                      ) : (
                        <Circle className="h-3.5 w-3.5 shrink-0 text-navy/25" strokeWidth={2} />
                      )}
                      <span className="truncate">{lesson.title}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2.5 text-sm font-semibold text-navy"
        >
          <List className="h-4 w-4" strokeWidth={2} />
          Course Index
        </button>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="absolute inset-0 bg-navy/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full w-[85%] max-w-sm flex-col overflow-y-auto bg-cream-dim p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="truncate font-display text-sm font-bold text-navy">{courseTitle}</p>
              <button
                type="button"
                aria-label="Close course index"
                onClick={() => setMobileOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-navy hover:bg-white"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            {list}
          </div>
        </div>
      ) : null}

      <aside className="hidden lg:block lg:w-72 lg:shrink-0">
        <div className="lg:sticky lg:top-10">
          <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-wide text-navy/40">
            Course Index
          </p>
          {list}
        </div>
      </aside>
    </>
  );
}
