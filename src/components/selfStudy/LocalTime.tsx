"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime, formatTimeLeft } from "@/lib/selfStudy/constants";

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

export function LocalDateTime({ iso }: { iso: string }) {
  const isClient = useIsClient();
  return <>{isClient ? formatDateTime(iso) : ""}</>;
}

export function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const isClient = useIsClient();
  return <>{isClient ? formatTimeLeft(expiresAt) : `Deleted after 3 days`}</>;
}
