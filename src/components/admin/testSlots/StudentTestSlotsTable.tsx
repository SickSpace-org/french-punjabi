"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { setStudentTestSlot } from "@/app/admin/(dashboard)/test-slots/actions";
import type { AdminStudentTestSlot } from "@/lib/testSlots/getAdminStudentTestSlots";
import { useToast } from "@/components/admin/ToastProvider";

function StudentRow({ slot }: { slot: AdminStudentTestSlot }) {
  const { showToast } = useToast();
  const [startTime, setStartTime] = useState(slot.startTime?.slice(0, 5) ?? "");
  const [meetingLink, setMeetingLink] = useState(slot.meetingLink ?? "");
  const [note, setNote] = useState(slot.note ?? "");
  const [saved, setSaved] = useState({ startTime, meetingLink, note });
  const [saving, setSaving] = useState(false);

  const dirty = startTime !== saved.startTime || meetingLink !== saved.meetingLink || note !== saved.note;

  const handleSave = async () => {
    setSaving(true);
    const result = await setStudentTestSlot(slot.studentId, { startTime, meetingLink, note });
    setSaving(false);
    if (result.ok) {
      setSaved({ startTime, meetingLink, note });
      showToast("Saved.");
    } else {
      showToast(result.error, "error");
    }
  };

  return (
    <tr className="border-b border-navy/5 last:border-0">
      <td className="px-3 py-2 font-semibold text-navy">{slot.fullName}</td>
      <td className="px-2 py-2">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 text-xs text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="url"
          value={meetingLink}
          onChange={(e) => setMeetingLink(e.target.value)}
          placeholder="Meeting link"
          className="w-full min-w-[160px] rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 text-xs text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="w-full min-w-[140px] rounded-lg border border-navy/15 bg-white px-2.5 py-1.5 text-xs text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </td>
      <td className="px-2 py-2 text-right">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream-dim disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={2} />
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export default function StudentTestSlotsTable({ students }: { students: AdminStudentTestSlot[] }) {
  return (
    <div className="mt-8">
      <p className="text-xs font-bold uppercase tracking-wide text-red-dark">Per-Student Friday Slots</p>
      <p className="mt-1 text-sm text-navy/60">
        Give each student their own Friday test time and join link — this is what shows on their
        dashboard and their Test page.
      </p>

      {students.length === 0 ? (
        <p className="mt-4 text-sm text-navy/50">No active students yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-navy/10 bg-white">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-navy/10 text-[10px] font-bold uppercase tracking-wide text-navy/40">
                <th className="px-3 py-2">Student</th>
                <th className="px-2 py-2">Friday Time</th>
                <th className="px-2 py-2">Meeting Link</th>
                <th className="px-2 py-2">Note</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {students.map((slot) => (
                <StudentRow key={slot.studentId} slot={slot} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
