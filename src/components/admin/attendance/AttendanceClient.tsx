"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Save } from "lucide-react";
import { setAttendanceStatus, updateBatchAttendanceConfig } from "@/app/admin/(dashboard)/courses/actions";
import type { AttendanceBatchGroup } from "@/lib/attendance/getAdminAttendance";
import { DAY_LABELS, dayLabel } from "@/lib/attendance/schedule";
import { useToast } from "@/components/admin/ToastProvider";

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function BatchCard({ group }: { group: AttendanceBatchGroup }) {
  const { showToast } = useToast();
  const [meetingLink, setMeetingLink] = useState(group.meetingLink ?? "");
  const [classDays, setClassDays] = useState<number[]>(group.classDays);
  const [savedMeetingLink, setSavedMeetingLink] = useState(group.meetingLink ?? "");
  const [savedClassDays, setSavedClassDays] = useState<number[]>(group.classDays);
  const [saving, setSaving] = useState(false);

  const [presentByStudent, setPresentByStudent] = useState<Map<string, Set<string>>>(
    () => new Map(group.students.map((s) => [s.studentId, new Set(s.presentDates)]))
  );
  const [pendingCell, setPendingCell] = useState<string | null>(null);

  const dirty =
    meetingLink !== savedMeetingLink ||
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
    });
    setSaving(false);
    if (result.ok) {
      setSavedMeetingLink(meetingLink.trim());
      setSavedClassDays(classDays);
      showToast("Meeting link & schedule saved.");
    } else {
      showToast(result.error, "error");
    }
  };

  const toggleAttendance = async (studentId: string, date: string) => {
    const cellKey = `${studentId}|${date}`;
    const currentlyPresent = presentByStudent.get(studentId)?.has(date) ?? false;
    const nextPresent = !currentlyPresent;

    setPendingCell(cellKey);
    setPresentByStudent((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(studentId) ?? []);
      if (nextPresent) set.add(date);
      else set.delete(date);
      next.set(studentId, set);
      return next;
    });

    const result = await setAttendanceStatus(studentId, group.batchId, date, nextPresent);
    setPendingCell(null);

    if (!result.ok) {
      // Revert on failure.
      setPresentByStudent((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(studentId) ?? []);
        if (currentlyPresent) set.add(date);
        else set.delete(date);
        next.set(studentId, set);
        return next;
      });
      showToast(result.error, "error");
    }
  };

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold text-navy">{group.label}</p>
          <p className="mt-0.5 text-xs text-navy/50">
            {group.students.length} student{group.students.length === 1 ? "" : "s"} currently assigned
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
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

      {group.students.length === 0 ? (
        <p className="mt-4 text-sm text-navy/50">No students currently assigned to this batch.</p>
      ) : group.classDates.length === 0 ? (
        <p className="mt-4 text-sm text-navy/50">
          Pick class days above to start tracking attendance for this batch.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-navy/10">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-navy/10 text-[10px] font-bold uppercase tracking-wide text-navy/40">
                <th className="px-3 py-2">Student</th>
                {group.classDates.map((date) => (
                  <th key={date} className="px-2 py-2 text-center">
                    {dayLabel(date)}
                    <br />
                    {formatShortDate(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.students.map((student) => (
                <tr key={student.studentId} className="border-b border-navy/5 last:border-0">
                  <td className="px-3 py-2 font-semibold text-navy">
                    <Link href={`/admin/students/${student.studentId}`} className="hover:text-red-dark hover:underline">
                      {student.fullName}
                    </Link>
                  </td>
                  {group.classDates.map((date) => {
                    const present = presentByStudent.get(student.studentId)?.has(date) ?? false;
                    const cellKey = `${student.studentId}|${date}`;
                    const pending = pendingCell === cellKey;
                    return (
                      <td key={date} className="px-2 py-2 text-center">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleAttendance(student.studentId, date)}
                          title="Click to toggle Present/Absent"
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-opacity hover:opacity-75 disabled:cursor-wait disabled:opacity-50 ${
                            present
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-soft text-red-dark"
                          }`}
                        >
                          {present ? "P" : "A"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AttendanceClient({ initialGroups }: { initialGroups: AttendanceBatchGroup[] }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Attendance</h1>
      <p className="mt-1 text-sm text-navy/60">
        Set each batch&apos;s class meeting link and weekly schedule below. A student is marked
        Present (P) automatically when they click &ldquo;Join Class&rdquo; in their portal on a
        scheduled day — anything else is Absent (A). Click any P/A cell below to override it by
        hand.
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
