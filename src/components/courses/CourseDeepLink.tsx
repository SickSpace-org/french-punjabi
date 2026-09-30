"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Phase } from "@/lib/courses/types";
import { DEEP_LINK_SELECT_EVENT, type DeepLinkSelectDetail } from "./deepLinkEvent";

/** How long the "this is the course I clicked" highlight stays visible. */
const HIGHLIGHT_MS = 1600;

/**
 * Renders nothing — reads ?level= on a phase page (set by courseHref),
 * scrolls the matching Level card into view and briefly highlights it.
 * A single-timing level is also pre-selected so Enroll works immediately.
 */
export default function CourseDeepLink({ phase }: { phase: Phase }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const levelParam = searchParams.get("level");
    if (!levelParam) return;

    const batch = phase.batches[Number(levelParam) - 1];
    if (!batch) return;

    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(batch.id);
      if (!el) return;

      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("course-highlight");
      window.setTimeout(() => el.classList.remove("course-highlight"), HIGHLIGHT_MS);

      if (batch.timings.length === 1) {
        window.dispatchEvent(
          new CustomEvent<DeepLinkSelectDetail>(DEEP_LINK_SELECT_EVENT, {
            detail: {
              phaseId: phase.id,
              batchId: batch.id,
              timingId: batch.timings[0].id,
            },
          })
        );
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [searchParams, phase]);

  return null;
}
