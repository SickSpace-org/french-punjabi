/**
 * Single source of truth for course phases, levels/batches, timings, and
 * pricing. Update a value here and it updates everywhere it's rendered.
 * This shape is intentionally flat/serializable so it can later be
 * replaced by data fetched from a database or admin dashboard without
 * changing any of the Courses page components.
 */

export type Timing = {
  id: string;
  label: string;
  /** True when no confirmed time exists yet — rendered as "To Be Confirmed". */
  tbd?: boolean;
  /** Short qualifier shown alongside the time, e.g. "Morning Batch". */
  note?: string;
};

export type Batch = {
  id: string;
  title: string;
  teacher?: string;
  timings: Timing[];
};

export type PhasePricing = {
  /** Base program fee before tax, in USD. */
  base: number;
  /** e.g. 0.13 for 13%. */
  taxRate: number;
  /**
   * Published total after tax. Kept as a fixed, editable value rather than
   * derived from base * (1 + taxRate) — verify against the stated tax rate
   * before changing.
   */
  total: number;
  duration: string;
};

export type Phase = {
  id: string;
  number: string;
  /** Zero-padded phase code, e.g. "PHASE 01". */
  code: string;
  /** Short program name shown in the panel header, e.g. "Foundation". */
  title: string;
  /** e.g. "Months 1–3". */
  months: string;
  badge?: string;
  description: string;
  batches: Batch[];
  pricing: PhasePricing;
};

export const COURSES: Phase[] = [
  {
    id: "phase-1",
    number: "Phase 1",
    code: "Phase 01",
    title: "Foundation",
    months: "Months 1–3",
    badge: "3 Levels",
    description:
      "Build the foundation of French through progressive Level 1, Level 2 and Level 3 classes.",
    batches: [
      {
        id: "phase-1-level-1",
        title: "Level 1",
        timings: [
          { id: "p1-l1-t1", label: "8:00 PM EST" },
          { id: "p1-l1-t2", label: "10:00 PM EST" },
          { id: "p1-l1-t3", label: "8:30 AM EST" },
        ],
      },
      {
        id: "phase-1-level-2",
        title: "Level 2",
        timings: [
          { id: "p1-l2-t1", label: "9:00 PM EST" },
          { id: "p1-l2-t2", label: "11:00 AM EST", note: "Morning Batch" },
        ],
      },
      {
        id: "phase-1-level-3",
        title: "Level 3",
        timings: [
          { id: "p1-l3-t1", label: "10:00 PM EST" },
          { id: "p1-l3-t2", label: "11:00 PM EST" },
          { id: "p1-l3-t3", label: "10:00 AM EST", note: "Morning Batch" },
        ],
      },
    ],
    pricing: { base: 549, taxRate: 0.13, total: 620.37, duration: "3 Months" },
  },
  {
    id: "phase-2",
    number: "Phase 2",
    code: "Phase 02",
    title: "TEF / TCF Preparation",
    months: "Months 4–5",
    badge: "2 Levels",
    description:
      "Move from foundational French into practical communication and focused TEF/TCF preparation.",
    batches: [
      {
        id: "phase-2-level-1",
        title: "Level 1",
        timings: [{ id: "p2-l1-t1", label: "11:00 PM EST" }],
      },
      {
        id: "phase-2-level-2",
        title: "Level 2",
        timings: [{ id: "p2-l2-t1", label: "8:00 PM EST" }],
      },
    ],
    pricing: { base: 349, taxRate: 0.13, total: 394.37, duration: "2 Months" },
  },
  {
    id: "phase-3",
    number: "Phase 3",
    code: "Phase 03",
    title: "Exam Mastery",
    months: "Months 6–7",
    description: "Advanced exam-focused batches, mock practice and final preparation.",
    batches: [
      {
        id: "phase-3-batch-1",
        title: "Hitesh Batch",
        teacher: "Hitesh",
        timings: [{ id: "p3-b1-t1", label: "10:00 PM EST" }],
      },
      {
        id: "phase-3-batch-2",
        title: "Hitesh Batch",
        teacher: "Hitesh",
        timings: [{ id: "p3-b2-t1", label: "9:00 PM EST" }],
      },
      {
        id: "phase-3-native",
        title: "Native Batch",
        timings: [{ id: "p3-native-t1", label: "9:00 PM EST" }],
      },
      {
        id: "phase-3-tcf",
        title: "TCF Batch",
        timings: [{ id: "p3-tcf-t1", label: "10:00 PM EST" }],
      },
      {
        id: "phase-3-tef-morning",
        title: "TEF Morning Batch",
        timings: [{ id: "p3-tef-morning-t1", label: "Morning Timing", tbd: true }],
      },
      {
        id: "phase-3-tcf-native",
        title: "TCF Native",
        timings: [{ id: "p3-tcf-native-t1", label: "8:30 AM EST" }],
      },
    ],
    pricing: { base: 349, taxRate: 0.13, total: 394.37, duration: "2 Months" },
  },
];
