/**
 * Shared route builder for linking to a phase's own page, optionally
 * jumping to one Level's batches (?level=), read by CourseDeepLink there.
 * Single source of truth so every page links the same way.
 */
export function courseHref(phaseNumber: number, levelNumber?: number) {
  const base = `/courses/phase-${phaseNumber}`;
  return levelNumber === undefined ? base : `${base}?level=${levelNumber}#batches`;
}

/** "Phase 2" → 2. Phases from the database carry their number only as display text. */
export function phaseNumberOf(phase: { number: string }) {
  return Number(phase.number.replace(/\D/g, "")) || 0;
}
