/**
 * Placeholder content for the Results page — student reviews and result
 * photos. Replace `photo` with a path under /public/images/ and swap the
 * copy for real quotes/results as they come in.
 */

export type Review = {
  id: string;
  name: string;
  batch: string;
  quote: string;
  photo?: string;
};

export const REVIEWS: Review[] = [
  {
    id: "review-1",
    name: "Student Name",
    batch: "Phase 1 · Level 1",
    quote:
      "[ Editable placeholder — add this student's real review once shared. ]",
  },
  {
    id: "review-2",
    name: "Student Name",
    batch: "Phase 2 Batch",
    quote:
      "[ Editable placeholder — add this student's real review once shared. ]",
  },
  {
    id: "review-3",
    name: "Student Name",
    batch: "TCF Batch",
    quote:
      "[ Editable placeholder — add this student's real review once shared. ]",
  },
  {
    id: "review-4",
    name: "Student Name",
    batch: "Native Batch",
    quote:
      "[ Editable placeholder — add this student's real review once shared. ]",
  },
  {
    id: "review-5",
    name: "Student Name",
    batch: "Phase 1 · Level 3",
    quote:
      "[ Editable placeholder — add this student's real review once shared. ]",
  },
  {
    id: "review-6",
    name: "Student Name",
    batch: "TCF Native",
    quote:
      "[ Editable placeholder — add this student's real review once shared. ]",
  },
];

export type StudentResult = {
  id: string;
  name: string;
  batch: string;
  photo?: string;
};

export const STUDENT_RESULTS: StudentResult[] = [
  {
    id: "result-1",
    name: "Ritik",
    batch: "TCF Canada Graduate",
    photo: "/images/results/ritik-tcf.jpg",
  },
  {
    id: "result-2",
    name: "Kamalpreet Kaur",
    batch: "TCF Canada Graduate",
    photo: "/images/results/kamalpreet-kaur-tcf.jpg",
  },
  {
    id: "result-3",
    name: "Kamini Sharma",
    batch: "TEF Canada Graduate",
    photo: "/images/results/kamini-sharma-tef.jpg",
  },
  {
    id: "result-4",
    name: "Arshdeep Singh",
    batch: "TEF Canada Graduate",
    photo: "/images/results/arshdeep-singh-tef.jpg",
  },
  {
    id: "result-5",
    name: "TEF Canada Graduate",
    batch: "C2 Level Achiever",
    photo: "/images/results/tef-c2-result.jpg",
  },
  {
    id: "result-6",
    name: "Siddharth",
    batch: "TCF Canada Graduate",
    photo: "/images/results/siddharth-tcf.jpg",
  },
];
