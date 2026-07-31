"use client";

import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import type { StudentNotification } from "@/lib/student/getNotifications";
import { markNotificationRead } from "@/app/student/actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationRow({ notification }: { notification: StudentNotification }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5 ${
        notification.isRead ? "border-navy/10 bg-white" : "border-red/20 bg-red-soft/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            notification.isRead ? "bg-navy/5 text-navy/40" : "bg-red-soft text-red"
          }`}
        >
          <Bell className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <p className="text-sm font-medium text-navy">{notification.message}</p>
          <p className="text-xs text-navy/50">{notification.lessonTitle}</p>
          <p className="text-[11px] text-navy/35">{formatDate(notification.createdAt)}</p>
        </div>
      </div>
      <Link
        href={`/student/courses/${notification.courseId}/lessons/${notification.lessonId}`}
        onClick={() => {
          if (!notification.isRead) void markNotificationRead(notification.id);
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-navy hover:border-red/30 hover:text-red-dark"
      >
        View Reply
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </div>
  );
}
