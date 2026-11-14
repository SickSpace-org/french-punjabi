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
  /** The underlying batch's own admin-set name, e.g. "Ace TCF 1" — shown alongside the time so a Level card with several batches pooled into it doesn't lose what distinguishes them. */
  name?: string;
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

/** One private 30-minute slot under a phase (a one-seat batch flagged is_one_on_one). */
export type OneOnOneSlot = {
  /** Real `batches.id` — the enroll form re-validates against it on the server. */
  id: string;
  /** e.g. "12:30 PM – 1:00 PM EST" */
  label: string;
  teacher?: string;
  /** False once someone has reserved it (first come, first served) until an admin reopens it. */
  open: boolean;
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
  /** Personalised one-on-one slots under this phase, kept out of `batches`. Empty when the admin hasn't opened any. */
  oneOnOneSlots: OneOnOneSlot[];
  /** Real `phases.id` — needed to sign up for "notify me" when no slot is open. */
  dbId: string;
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
  personalised_one_on_one?: ProgramOffer;
};
