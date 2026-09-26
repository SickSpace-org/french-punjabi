"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronDown, Save } from "lucide-react";
import { updateBatchAttendanceConfig } from "@/app/admin/(dashboard)/courses/actions";
import type { AttendanceBatchGroup } from "@/lib/attendance/getAdminAttendance";
import { DAY_LABELS } from "@/lib/attendance/schedule";
import { useToast } from "@/components/admin/ToastProvider";

function BatchCard({ group }: { group: AttendanceBatchGroup }) {
  const { showToast } = useToast();
  const [meetingLink, setMeetingLink] = useState(group.meetingLink ?? "");
  const [classDays, setClassDays] = useState<number[]>(group.classDays);
  const [classTime, setClassTime] = useState(group.classTime ?? "");
  const [savedMeetingLink, setSavedMeetingLink] = useState(group.meetingLink ?? "");
  const [savedClassDays, setSavedClassDays] = useState<number[]>(group.classDays);
  const [savedClassTime, setSavedClassTime] = useState(group.classTime ?? "");
  const [saving, setSaving] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const studentCount = group.assignedStudents.length;

  const dirty =
    meetingLink !== savedMeetingLink ||
    classTime !== savedClassTime ||
    classDays.length !== savedClassDays.length ||
    classDays.some((d) => !savedClassDays.includes(d));

  const toggleDay = (day: number) => {
    setClassDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateBatchAttendanceConfig(group.batchId, {
      meetingLink: meetingLink.trim() || null,
      classDays,
      classTime: classTime || null,
    });
    setSaving(false);
    if (result.ok) {
      setSavedMeetingLink(meetingLink.trim());
      setSavedClassDays(classDays);
      setSavedClassTime(classTime);
      showToast("Meeting link & schedule saved.");
    } else {
      showToast(result.error, "error");
    }
  };

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold text-navy">{group.label}</p>
          <button
            type="button"
            onClick={() => setRosterOpen((v) => !v)}
            disabled={studentCount === 0}
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-navy/50 hover:text-navy/70 disabled:cursor-default disabled:hover:text-navy/50"
          >
            {studentCount} student{studentCount === 1 ? "" : "s"} currently assigned
            {studentCount > 0 ? (
              <ChevronDown
                className={`h-3 w-3 transition-transform ${rosterOpen ? "rotate-180" : ""}`}
                strokeWidth={2}
              />
            ) : null}
          </button>
        </div>
      </div>

      {rosterOpen && studentCount > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {group.assignedStudents.map((student) => (
            <li key={student.studentId}>
              <Link
                href={`/admin/students/${student.studentId}`}
                className="inline-flex items-center rounded-full border border-navy/15 bg-cream-dim px-3 py-1 text-xs font-semibold text-navy hover:border-red/30 hover:bg-red-soft hover:text-red-dark"
              >
                {student.fullName}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
            Class Meeting Link
          </label>
          <input
            type="url"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="https://zoom.us/j/… or https://meet.google.com/…"
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
            Class Start Time
          </label>
          <input
            type="time"
            value={classTime}
            onChange={(e) => setClassTime(e.target.value)}
            className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10 sm:w-auto"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-navy/40">
        Students are auto-marked Present only if they click Join Class within 30 minutes before or
        after this time. Leave it blank to allow check-in any time on a scheduled day.
      </p>

      <div className="mt-3">
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
          Class Days
        </label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DAY_LABELS.map((label, day) => {
            const active = classDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? "border-red/30 bg-red-soft text-red-dark"
                    : "border-navy/15 bg-white text-navy/60 hover:bg-cream-dim"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AttendanceClient({ initialGroups }: { initialGroups: AttendanceBatchGroup[] }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Attendance</h1>
      <p className="mt-1 text-sm text-navy/60">
        Set each batch&apos;s class meeting link, start time, and weekly schedule below. A student is
        marked Present (P) automatically when they click &ldquo;Join Class&rdquo; in their portal
        within 30 minutes of the start time on a scheduled day — anything else is Absent (A). A
        student&apos;s own attendance history is on their Students page.
      </p>

      {initialGroups.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <CalendarClock className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">No batches found.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {initialGroups.map((group) => (
            <BatchCard key={group.batchId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
