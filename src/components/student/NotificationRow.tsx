"use client";

import Link from "next/link";
import { ArrowRight, Bell, CreditCard, Megaphone, MessageSquare, PartyPopper } from "lucide-react";
import type { StudentNotification } from "@/lib/student/getNotifications";
import { markNotificationRead } from "@/app/student/actions";
import { formatTimestampMediumWithTime as formatDate } from "@/lib/format/date";

/** Payment alerts split into two visual tones: the good-news ones read like
 * admin_message (neutral navy), the ones asking for attention (a failed
 * charge, paused/revoked access) read like the red unread style already
 * used for teacher/lesson notifications. */
const ATTENTION_ALERT_KINDS = new Set(["payment_failed", "access_suspended", "access_revoked"]);

export default function NotificationRow({ notification }: { notification: StudentNotification }) {
  const isAdminMessage = notification.kind === "admin_message";
  const isTeacherMessage = notification.kind === "teacher_message";
  const isPaymentAlert = notification.kind === "payment_alert";
  const isGoodNewsAlert = isPaymentAlert && !ATTENTION_ALERT_KINDS.has(notification.alertKind);
  const isDirectMessage = isAdminMessage || isTeacherMessage || isPaymentAlert;
  const isNeutralTone = isAdminMessage || isGoodNewsAlert;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5 ${
        notification.isRead
          ? "border-navy/10 bg-white"
          : isNeutralTone
            ? "border-navy/25 bg-navy/5"
            : "border-red/20 bg-red-soft/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            notification.isRead
              ? "bg-navy/5 text-navy/40"
              : isNeutralTone
                ? "bg-navy/15 text-navy"
                : "bg-red-soft text-red"
          }`}
        >
          {isAdminMessage ? (
            <Megaphone className="h-4 w-4" strokeWidth={2} />
          ) : isTeacherMessage ? (
            <MessageSquare className="h-4 w-4" strokeWidth={2} />
          ) : isPaymentAlert ? (
            notification.alertKind === "referral_reward" ? (
              <PartyPopper className="h-4 w-4" strokeWidth={2} />
            ) : (
              <CreditCard className="h-4 w-4" strokeWidth={2} />
            )
          ) : (
            <Bell className="h-4 w-4" strokeWidth={2} />
          )}
        </span>
        <div>
          <p className="text-sm font-medium text-navy">{notification.message}</p>
          <p className="text-xs text-navy/50">
            {isAdminMessage
              ? "From: Admin"
              : isTeacherMessage
                ? `From ${notification.teacherName}`
                : isPaymentAlert
                  ? "Billing"
                  : notification.lessonTitle}
          </p>
          <p className="text-[11px] text-navy/35">{formatDate(notification.createdAt)}</p>
        </div>
      </div>

      {isDirectMessage ? (
        !notification.isRead ? (
          <button
            type="button"
            onClick={() => void markNotificationRead(notification.id, notification.kind)}
            className="inline-flex shrink-0 items-center rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-navy hover:border-red/30 hover:text-red-dark"
          >
            Mark Read
          </button>
        ) : null
      ) : (
        <Link
          href={`/student/courses/${notification.courseId}/lessons/${notification.lessonId}`}
          onClick={() => {
            if (!notification.isRead) void markNotificationRead(notification.id, "lesson_reply");
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-navy hover:border-red/30 hover:text-red-dark"
        >
          View Reply
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
