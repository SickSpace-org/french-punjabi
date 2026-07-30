"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { COURSES } from "@/data/courses";
import { DEEP_LINK_SELECT_EVENT, type DeepLinkSelectDetail } from "./deepLinkEvent";

/** How long the "this is the course I clicked" highlight stays visible. */
const HIGHLIGHT_MS = 1600;

/**
 * Renders nothing — reads ?phase=&level= (set by the Structure page level
 * cards), scrolls the matching Phase panel or Level card into view, and
 * gives it a brief highlight. Phase 3 has no per-level batches on this
 * page, so a phase-only link (no level) just scrolls to that Phase panel.
 */
export default function CourseDeepLink() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const phaseParam = searchParams.get("phase");
    if (!phaseParam) return;

    const phase = COURSES.find((p) => p.number === `Phase ${phaseParam}`);
    if (!phase) return;

    const levelParam = searchParams.get("level");
    const batch = levelParam ? phase.batches[Number(levelParam) - 1] : undefined;
    const targetId = batch ? batch.id : phase.id;

    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(targetId);
      if (!el) return;

      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("course-highlight");
      window.setTimeout(() => el.classList.remove("course-highlight"), HIGHLIGHT_MS);

      if (batch && batch.timings.length === 1) {
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
  }, [searchParams]);

  return null;
}
