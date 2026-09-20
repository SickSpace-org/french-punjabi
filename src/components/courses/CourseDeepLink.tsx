"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { Phase } from "@/lib/courses/types";
import { DEEP_LINK_SELECT_EVENT, type DeepLinkSelectDetail } from "./deepLinkEvent";

/** How long the "this is the course I clicked" highlight stays visible. */
const HIGHLIGHT_MS = 1600;

/**
 * Renders nothing — reads ?phase=&level= (set by the Structure/Syllabus
 * page level cards), scrolls the matching Phase panel or Level card into
 * view, and gives it a brief highlight. A phase-only link (no level) just
 * scrolls to that Phase panel — used for a phase with no Levels at all, or
 * when linking to the phase in general.
 */
export default function CourseDeepLink({ phases }: { phases: Phase[] }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const phaseParam = searchParams.get("phase");
    if (!phaseParam) return;

    const phase = phases.find((p) => p.number === `Phase ${phaseParam}`);
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
  }, [searchParams, phases]);

  return null;
}
