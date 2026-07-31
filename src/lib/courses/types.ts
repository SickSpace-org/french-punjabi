/**
 * Public-facing course shape — same contract the Courses page components
 * have always used (id/title/timings arrays), now populated from Supabase
 * instead of the old hardcoded src/data/courses.ts. Keeping this shape
 * stable is what let the existing components (PhaseStepper, CourseDeepLink,
 * PhasePanel, ...) keep their scroll-anchor and deep-link logic unchanged.
 */

export type TimingStatus = "available" | "almost_full" | "full";

export type Timing = {
  id: string;
  /** Combined display string, e.g. "8:00 PM EST" or "Morning Timing". */
  label: string;
  tbd?: boolean;
  note?: string;
  status: TimingStatus;
  /** Remaining seats, when the batch has a total_slots cap set. */
  seatsLeft?: number;
};

export type Batch = {
  /** Stable slug — used as the DOM anchor id and for ?phase=&level= deep links. */
  id: string;
  title: string;
  teacher?: string;
  timings: Timing[];
};

export type PhasePricingMode = {
  base: number;
  taxRate: number;
  total: number;
  duration?: string;
};

export type Phase = {
  id: string;
  number: string;
  code: string;
  title: string;
  months: string;
  badge?: string;
  description: string;
  batches: Batch[];
  pricing: {
    full: PhasePricingMode;
    monthly: PhasePricingMode;
  };
};

export type ProgramOffer = {
  label: string;
  base: number;
  total?: number;
  taxRate?: number;
  duration?: string;
};

export type ProgramOffers = {
  complete_program?: ProgramOffer;
  redo_month?: ProgramOffer;
};
