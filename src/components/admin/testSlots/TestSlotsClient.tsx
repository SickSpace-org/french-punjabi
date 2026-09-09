"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus, Save, Trash2 } from "lucide-react";
import {
  createTestSlot,
  deleteTestSlot,
  setTestSlotActive,
  updateTestSlot,
  type TestSlotFormInput,
} from "@/app/admin/(dashboard)/test-slots/actions";
import type { TestSlotRow } from "@/types/database";
import { useToast } from "@/components/admin/ToastProvider";

const EMPTY_FORM: TestSlotFormInput = {
  title: "Mock Test",
  startTime: "",
  durationMinutes: 15,
  meetingLink: "",
  note: "",
};

function toFormInput(slot: TestSlotRow): TestSlotFormInput {
  return {
    title: slot.title,
    startTime: slot.start_time.slice(0, 5),
    durationMinutes: slot.duration_minutes,
    meetingLink: slot.meeting_link ?? "",
    note: slot.note ?? "",
  };
}

function SlotForm({
  form,
  onChange,
  onSubmit,
  saving,
  submitLabel,
}: {
  form: TestSlotFormInput;
  onChange: (form: TestSlotFormInput) => void;
  onSubmit: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          placeholder="Mock Test"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
          Start Time (Every Friday)
        </label>
        <input
          type="time"
          value={form.startTime}
          onChange={(e) => onChange({ ...form, startTime: e.target.value })}
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
          Duration (minutes)
        </label>
        <input
          type="number"
          min={1}
          value={form.durationMinutes}
          onChange={(e) => onChange({ ...form, durationMinutes: Number(e.target.value) || 0 })}
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
          Meeting Link
        </label>
        <input
          type="url"
          value={form.meetingLink}
          onChange={(e) => onChange({ ...form, meetingLink: e.target.value })}
          placeholder="https://zoom.us/j/… or https://meet.google.com/…"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-[11px] font-bold uppercase tracking-wide text-navy/40">
          Note (shown to students, optional)
        </label>
        <input
          type="text"
          value={form.note}
          onChange={(e) => onChange({ ...form, note: e.target.value })}
          placeholder="e.g. Bring a pen and paper"
          className="mt-1 w-full rounded-xl border border-navy/15 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="button"
          disabled={saving || !form.startTime}
          onClick={onSubmit}
          className="inline-flex items-center gap-1.5 rounded-full bg-red px-5 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={2} />
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function SlotCard({ slot }: { slot: TestSlotRow }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TestSlotFormInput>(() => toFormInput(slot));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateTestSlot(slot.id, form);
    setSaving(false);
    if (result.ok) {
      setEditing(false);
      showToast("Test slot saved.");
      router.refresh();
    } else {
      showToast(result.error, "error");
    }
  };

  const handleToggleActive = async () => {
    setBusy(true);
    const result = await setTestSlotActive(slot.id, !slot.is_active);
    setBusy(false);
    if (result.ok) router.refresh();
    else showToast(result.error, "error");
  };

  const handleDelete = async () => {
    setBusy(true);
    const result = await deleteTestSlot(slot.id);
    setBusy(false);
    if (result.ok) router.refresh();
    else showToast(result.error, "error");
  };

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold text-navy">{slot.title}</p>
          <p className="mt-0.5 text-xs text-navy/50">
            Every Friday, {slot.start_time.slice(0, 5)} · {slot.duration_minutes} min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
              slot.is_active ? "bg-emerald-50 text-emerald-700" : "bg-navy/5 text-navy/40"
            }`}
          >
            {slot.is_active ? "Active" : "Hidden"}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing((prev) => !prev)}
            className="rounded-full border border-navy/15 px-3 py-1 text-[11px] font-semibold text-navy hover:bg-cream-dim disabled:opacity-50"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleToggleActive}
            className="rounded-full border border-navy/15 px-3 py-1 text-[11px] font-semibold text-navy hover:bg-cream-dim disabled:opacity-50"
          >
            {slot.is_active ? "Hide" : "Unhide"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            title="Delete this test slot"
            className="rounded-full border border-navy/15 p-1.5 text-navy/50 hover:border-red/30 hover:text-red-dark disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 border-t border-navy/10 pt-4">
          <SlotForm form={form} onChange={setForm} onSubmit={handleSave} saving={saving} submitLabel="Save" />
        </div>
      ) : (
        <div className="mt-2 text-xs text-navy/50">
          {slot.meeting_link ? (
            <p className="truncate">Link: {slot.meeting_link}</p>
          ) : (
            <p className="text-red-dark">No meeting link set yet — students won&apos;t see a Join button.</p>
          )}
          {slot.note ? <p className="mt-0.5">{slot.note}</p> : null}
        </div>
      )}
    </div>
  );
}

export default function TestSlotsClient({ initialSlots }: { initialSlots: TestSlotRow[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const slots = initialSlots;
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<TestSlotFormInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    const result = await createTestSlot(form);
    setSaving(false);
    if (result.ok) {
      setCreating(false);
      setForm(EMPTY_FORM);
      showToast("Test slot created.");
      router.refresh();
    } else {
      showToast(result.error, "error");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy">Test Slots</h1>
          <p className="mt-1 text-sm text-navy/60">
            Set the weekly mock test slot(s) shown on every student&apos;s dashboard — always Friday,
            with the time, duration, and join link you choose here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-full bg-red px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-dark"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          {creating ? "Cancel" : "New Test Slot"}
        </button>
      </div>

      {creating ? (
        <div className="mt-5 rounded-2xl border border-navy/10 bg-white p-5">
          <SlotForm form={form} onChange={setForm} onSubmit={handleCreate} saving={saving} submitLabel="Create" />
        </div>
      ) : null}

      {slots.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <CalendarClock className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">No test slots yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {slots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} />
          ))}
        </div>
      )}
    </div>
  );
}
