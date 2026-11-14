import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OneOnOneNotifyRow } from "@/types/database";
import { DEFAULT_TEACHER_EMAIL, DEFAULT_TEACHER_NAME } from "@/data/personalisedOneOnOne";

export type SlotState = "open" | "reserved" | "taken" | "closed" | "hidden";

export type AdminSlotStudent = {
  enrollmentId: string;
  name: string;
  email: string;
  ref: string;
  paymentStatus: "PENDING" | "PAID";
  /** The student's portal status once payment was confirmed, else null. */
  studentStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED" | null;
};

export type AdminSlot = {
  id: string;
  label: string;
  timezone: string;
  teacherName: string | null;
  state: SlotState;
  student: AdminSlotStudent | null;
};

export type AdminOneOnOnePhase = {
  id: string;
  title: string;
  slots: AdminSlot[];
  notify: OneOnOneNotifyRow[];
};

export type TeacherChoice = { id: string; fullName: string };

export type AdminOneOnOneData = {
  phases: AdminOneOnOnePhase[];
  teachers: TeacherChoice[];
  /** Pre-selected teacher for new slots: the one matching the default email, else first name. */
  defaultTeacherId: string | null;
};

type BatchQueryRow = {
  id: string;
  phase_id: string | null;
  time_label: string;
  timezone: string;
  teacher_name: string | null;
  is_active: boolean;
  availability_status: string;
  total_slots: number | null;
  filled_slots: number;
  held_slots: number;
  display_order: number;
};

function slotState(b: BatchQueryRow): SlotState {
  if (!b.is_active || b.availability_status === "hidden") return "hidden";
  if (b.held_slots > 0) return "reserved";
  if (b.filled_slots > 0) return "taken";
  // Marked full by hand (or after a student quit) without a seat count: closed until reopened.
  if (b.availability_status === "full") return "closed";
  return "open";
}

/** Everything the admin One-on-One page shows. Relies on the caller's session being an admin (RLS). */
export async function getAdminOneOnOne(supabase: SupabaseClient<Database>): Promise<AdminOneOnOneData> {
  const [phasesResult, batchesResult, notifyResult, teachersResult] = await Promise.all([
    supabase.from("phases").select("id, title, phase_number").eq("is_active", true).order("phase_number"),
    supabase
      .from("batches")
      .select("id, phase_id, time_label, timezone, teacher_name, is_active, availability_status, total_slots, filled_slots, held_slots, display_order")
      .eq("is_one_on_one", true)
      .order("display_order"),
    supabase.from("one_on_one_notify").select("*").order("created_at"),
    supabase.from("teachers").select("id, full_name, email").eq("status", "ACTIVE").order("full_name"),
  ]);

  if (phasesResult.error) throw phasesResult.error;
  if (batchesResult.error) throw batchesResult.error;
  if (notifyResult.error) throw notifyResult.error;
  if (teachersResult.error) throw teachersResult.error;

  const batches = (batchesResult.data ?? []) as unknown as BatchQueryRow[];
  const batchIds = batches.map((b) => b.id);

  // The most recent live enrollment per slot tells the admin who holds it.
  const studentByBatch = new Map<string, AdminSlotStudent>();
  if (batchIds.length > 0) {
    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select("id, batch_id, full_name, email, enrollment_ref, payment_status, student_id")
      .in("batch_id", batchIds)
      .neq("status", "NOT_INTERESTED")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const studentIds = [...new Set((enrollments ?? []).map((e) => e.student_id).filter((id): id is string => Boolean(id)))];
    const statusById = new Map<string, "ACTIVE" | "INACTIVE" | "SUSPENDED">();
    if (studentIds.length > 0) {
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, status")
        .in("id", studentIds);
      if (studentsError) throw studentsError;
      for (const s of students ?? []) statusById.set(s.id, s.status);
    }

    for (const e of enrollments ?? []) {
      if (!e.batch_id || studentByBatch.has(e.batch_id)) continue;
      studentByBatch.set(e.batch_id, {
        enrollmentId: e.id,
        name: e.full_name,
        email: e.email,
        ref: e.enrollment_ref,
        paymentStatus: e.payment_status,
        studentStatus: e.student_id ? (statusById.get(e.student_id) ?? null) : null,
      });
    }
  }

  const notifyRows = (notifyResult.data ?? []) as OneOnOneNotifyRow[];

  const phases: AdminOneOnOnePhase[] = (phasesResult.data ?? []).map((phase) => ({
    id: phase.id,
    title: phase.title,
    slots: batches
      .filter((b) => b.phase_id === phase.id)
      .map((b) => ({
        id: b.id,
        label: b.time_label,
        timezone: b.timezone,
        teacherName: b.teacher_name,
        state: slotState(b),
        student: studentByBatch.get(b.id) ?? null,
      })),
    notify: notifyRows.filter((n) => n.phase_id === phase.id),
  }));

  const teachers: TeacherChoice[] = (teachersResult.data ?? []).map((t) => ({ id: t.id, fullName: t.full_name }));
  const defaultTeacher =
    (teachersResult.data ?? []).find((t) => t.email.trim().toLowerCase() === DEFAULT_TEACHER_EMAIL) ??
    (teachersResult.data ?? []).find((t) => t.full_name.toLowerCase().startsWith(DEFAULT_TEACHER_NAME.toLowerCase()));

  return { phases, teachers, defaultTeacherId: defaultTeacher?.id ?? null };
}
