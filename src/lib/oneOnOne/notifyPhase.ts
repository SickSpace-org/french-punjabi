import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendSeatOpenEmail } from "@/lib/email/send";
import { ONE_ON_ONE_ANCHOR, PERSONALISED_TITLE } from "@/data/personalisedOneOnOne";

type AdminSupabase = SupabaseClient<Database>;

/**
 * Emails everyone still waiting for this phase's next one-on-one slot and
 * stamps notified_at. With includeNotified (admin "email again") it also
 * re-emails people who were already told. Runs with the admin's session, so
 * RLS limits it to admins. Best-effort: returns how many were emailed and
 * never throws, so a mail hiccup can't fail the admin's own action.
 */
export async function notifyOneOnOnePhase(
  supabase: AdminSupabase,
  phaseId: string,
  { includeNotified = false }: { includeNotified?: boolean } = {}
): Promise<number> {
  try {
    const { data: phase } = await supabase.from("phases").select("slug, title").eq("id", phaseId).maybeSingle();
    if (!phase) return 0;

    let query = supabase.from("one_on_one_notify").select("id, full_name, email").eq("phase_id", phaseId);
    if (!includeNotified) query = query.is("notified_at", null);
    const { data: waiting, error } = await query;
    if (error || !waiting?.length) return 0;

    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const info = {
      courseName: `${phase.title} — ${PERSONALISED_TITLE}`,
      batchTiming: "New one-on-one slots are open",
      enrollUrl: `${site}/courses/${phase.slug}#${ONE_ON_ONE_ANCHOR}`,
    };

    const notifiedIds: string[] = [];
    for (const person of waiting) {
      const result = await sendSeatOpenEmail(person.email, { fullName: person.full_name, ...info });
      if (result.sent) notifiedIds.push(person.id);
    }

    if (notifiedIds.length) {
      await supabase
        .from("one_on_one_notify")
        .update({ notified_at: new Date().toISOString() })
        .in("id", notifiedIds);
    }
    return notifiedIds.length;
  } catch (error) {
    console.error("[One-on-one] Failed to notify phase waiting list:", error);
    return 0;
  }
}
