import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { reopenSlot } from "@/lib/oneOnOne/slots";
import { notifyOneOnOnePhase } from "@/lib/oneOnOne/notifyPhase";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminSupabase = SupabaseClient<Database>;

function revalidateOneOnOne() {
  revalidatePath("/admin/one-on-one");
  revalidatePath("/courses", "layout");
}

/**
 * True when this enrollment is the one currently holding a one-on-one slot,
 * meaning it's the latest live (not "not interested") enrollment on it. An
 * older enrollment can never count, so it can't free a slot that someone else
 * has since reserved.
 */
export async function isSlotHolder(supabase: AdminSupabase, batchId: string, enrollmentId: string): Promise<boolean> {
  const { data: slot } = await supabase.from("batches").select("is_one_on_one").eq("id", batchId).maybeSingle();
  if (!slot?.is_one_on_one) return false;

  const { data: holder } = await supabase
    .from("enrollments")
    .select("id")
    .eq("batch_id", batchId)
    .neq("status", "NOT_INTERESTED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return holder?.id === enrollmentId;
}

/** Puts one slot back to open and emails anyone waiting for its phase. Best-effort; never throws. */
export async function freeOneOnOneSlot(supabase: AdminSupabase, batchId: string): Promise<boolean> {
  try {
    const { data: slot } = await supabase.from("batches").select("phase_id").eq("id", batchId).maybeSingle();
    const result = await reopenSlot(batchId);
    if (!result.ok) return false;
    if (slot?.phase_id) await notifyOneOnOnePhase(supabase, slot.phase_id);
    revalidateOneOnOne();
    return true;
  } catch (error) {
    console.error("[One-on-one] Failed to free slot:", error);
    return false;
  }
}

/**
 * Frees any one-on-one slot a student is holding, for when they're marked
 * inactive or their account is deleted. Best-effort: it never throws, so a
 * hiccup here can't fail the status change the admin actually asked for. Call
 * it BEFORE deleting the student, because deleting unlinks their enrollments.
 * Returns how many slots were freed.
 */
export async function releaseOneOnOneSlotsForStudent(supabase: AdminSupabase, studentId: string): Promise<number> {
  try {
    const { data: mine } = await supabase
      .from("enrollments")
      .select("id, batch_id")
      .eq("student_id", studentId)
      .not("batch_id", "is", null);

    let freed = 0;
    for (const enrollment of mine ?? []) {
      if (!enrollment.batch_id) continue;
      if (!(await isSlotHolder(supabase, enrollment.batch_id, enrollment.id))) continue;
      if (await freeOneOnOneSlot(supabase, enrollment.batch_id)) freed += 1;
    }
    return freed;
  } catch (error) {
    console.error("[One-on-one] Failed to free slot for student:", error);
    return 0;
  }
}

/**
 * When an admin assigns a student to a one-on-one slot by hand (Students ->
 * change course), the slot must be taken so nobody else can reserve it. Marks
 * it as a seat in use if it is currently free. Returns false when the slot is
 * already reserved or taken, so the caller can refuse the move.
 */
export async function claimOneOnOneSlotForAssignment(batchId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("batches")
    .update({ filled_slots: 1, availability_status: "full" })
    .eq("id", batchId)
    .eq("is_one_on_one", true)
    .eq("held_slots", 0)
    .eq("filled_slots", 0)
    .in("availability_status", ["available", "almost_full"])
    .select("id");
  if (error) {
    console.error("[One-on-one] Failed to claim slot for assignment:", error);
    return false;
  }
  return (data?.length ?? 0) === 1;
}
