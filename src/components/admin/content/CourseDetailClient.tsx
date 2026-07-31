"use client";

import { useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import type { AdminCourseDetail } from "@/lib/content/getCourseDetail";
import WeekCard from "./WeekCard";
import WeekFormModal from "./WeekFormModal";

export default function CourseDetailClient({ initialCourse }: { initialCourse: AdminCourseDetail }) {
  const course = initialCourse;
  const [addingWeek, setAddingWeek] = useState(false);

  const nextWeekNumber = course.weeks.reduce((max, w) => Math.max(max, w.week_number), 0) + 1;
  const nextDisplayOrder = course.weeks.reduce((max, w) => Math.max(max, w.display_order), 0) + 1;

  // The single most common reason a lesson "doesn't show" to students: the
  // course itself is still DRAFT (or soft-deleted) — every week/lesson
  // underneath is invisible regardless of their own status.
  const courseVisible = course.status === "PUBLISHED" && course.is_active;

  return (
    <div className="space-y-4">
      {!courseVisible ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>
            This course is <strong>{!course.is_active ? "deleted" : course.status}</strong> — students
            won&apos;t see any of its weeks or lessons, even ones marked Published, until the course
            itself is published and active. Go back to Course Content to publish/restore it.
          </p>
        </div>
      ) : null}

      {course.weeks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-10 text-center text-sm text-navy/60">
          No weeks yet — add the first week to start building this course.
        </div>
      ) : (
        course.weeks.map((week) => (
          <WeekCard key={week.id} week={week} courseId={course.id} courseVisible={courseVisible} />
        ))
      )}

      <button
        type="button"
        onClick={() => setAddingWeek(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-navy/20 px-4 py-2.5 text-sm font-semibold text-navy/60 hover:border-red/30 hover:text-red"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Add Week
      </button>

      {addingWeek ? (
        <WeekFormModal
          mode="add"
          courseId={course.id}
          nextWeekNumber={nextWeekNumber}
          nextDisplayOrder={nextDisplayOrder}
          onClose={() => setAddingWeek(false)}
        />
      ) : null}
    </div>
  );
}
