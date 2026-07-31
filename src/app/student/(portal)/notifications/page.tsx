import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudent } from "@/lib/student/getCurrentStudent";
import { getStudentNotifications } from "@/lib/student/getNotifications";
import NotificationRow from "@/components/student/NotificationRow";

export const revalidate = 0;

export default async function StudentNotificationsPage() {
  const supabase = await createClient();
  const student = await getCurrentStudent(supabase);
  if (!student) return null;

  const notifications = await getStudentNotifications(supabase, student.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-navy">Notifications</h1>
      <p className="mt-1 text-sm text-navy/60">Replies from your teacher appear here.</p>

      {notifications.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-dim text-navy/40">
            <Bell className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-4 text-sm font-medium text-navy/60">No notifications yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
