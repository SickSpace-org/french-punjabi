/**
 * Fees that live outside the per-phase pricing in courses.ts: the
 * pay-monthly option, the full 7-month bundle, and the redo-a-month rate.
 */

export const TAX_LABEL = "+ 13% Tax";

export const MONTHLY_FEE = {
  label: "Monthly Option",
  base: 199,
  total: 224.87,
};

export const COMPLETE_PROGRAM_FEE = {
  id: "complete-program",
  label: "Complete 7-Month Program",
  base: 1200,
  /**
   * Published total after tax. Kept as a fixed, editable value — verify
   * against the stated tax rate before changing.
   */
  total: 1354.87,
  duration: "7 Months",
};

export const REDO_MONTH_FEE = {
  base: 199,
  label: "$199 + Tax / Month",
};
