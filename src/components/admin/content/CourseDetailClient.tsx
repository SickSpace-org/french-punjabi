"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { AdminCourseDetail } from "@/lib/content/getCourseDetail";
import WeekCard from "./WeekCard";
import WeekFormModal from "./WeekFormModal";

export default function CourseDetailClient({ initialCourse }: { initialCourse: AdminCourseDetail }) {
  const course = initialCourse;
  const [addingWeek, setAddingWeek] = useState(false);

  const nextWeekNumber = course.weeks.reduce((max, w) => Math.max(max, w.week_number), 0) + 1;
  const nextDisplayOrder = course.weeks.reduce((max, w) => Math.max(max, w.display_order), 0) + 1;

  return (
    <div className="space-y-4">
      {course.weeks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-10 text-center text-sm text-navy/60">
          No weeks yet — add the first week to start building this course.
        </div>
      ) : (
        course.weeks.map((week) => <WeekCard key={week.id} week={week} courseId={course.id} />)
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
