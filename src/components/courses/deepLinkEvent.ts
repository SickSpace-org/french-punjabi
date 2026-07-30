/**
 * Shared contract between CourseDeepLink (dispatches) and PhasePanel
 * (listens) so a Structure page deep link into a single-timing level can
 * pre-select that timing without requiring a click.
 */
export const DEEP_LINK_SELECT_EVENT = "course-deep-link-select";

export type DeepLinkSelectDetail = {
  phaseId: string;
  batchId: string;
  timingId: string;
};
