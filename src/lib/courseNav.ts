/**
 * Shared route builder for linking into a specific Phase/Level on the
 * Courses page (?phase=&level=), read by CourseDeepLink there. Single
 * source of truth so the Structure page and Syllabus page don't each
 * grow their own copy of this contract.
 */
export function courseHref(phaseNumber: number, levelNumber?: number) {
  if (levelNumber === undefined) {
    return `/courses?phase=${phaseNumber}`;
  }
  return `/courses?phase=${phaseNumber}&level=${levelNumber}`;
}
