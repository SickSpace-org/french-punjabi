"use client";

import { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";
import { formatDateTime, formatTimeLeft } from "@/lib/assignments/constants";

const subscribe = () => () => {};

/**
 * True only in the browser. Times are formatted there, in the viewer's own
 * timezone — the server renders in UTC, which would show the wrong hour and
 * cause a hydration mismatch.
 */
function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

export default function LocalDateTime({ iso }: { iso: string }) {
  const isClient = useIsClient();
  return <>{isClient ? formatDateTime(iso) : ""}</>;
}

export function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const isClient = useIsClient();
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-cream-dim px-2 py-0.5 text-[11px] font-semibold text-navy/55">
      <Clock className="h-3 w-3" strokeWidth={2} />
      {isClient ? formatTimeLeft(expiresAt) : "Deleted after 3 days"}
    </span>
  );
}
