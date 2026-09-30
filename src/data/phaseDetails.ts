/**
 * Extra content for each phase's own page (/courses/phase-N). Batches,
 * timings and fees come from Supabase; everything here is static copy.
 *
 * To add a phase video: paste a YouTube link (watch, youtu.be or shorts
 * URL all work) into `videoUrl`. Leave it empty to show "Video coming soon".
 */

export type PhaseDetail = {
  videoUrl: string;
  tagline: string;
  startsFrom: string;
  finishesAt: string;
  leaveWith: string[];
  pr: {
    heading: string;
    body: string;
  };
};

export const PHASE_DETAILS: Record<number, PhaseDetail> = {
  1: {
    videoUrl: "",
    tagline: "From your first French word to a complete A1–A2 grammar base.",
    startsFrom: "Zero, or a little French",
    finishesAt: "A1–A2 foundation",
    leaveWith: [
      "Pronounce French clearly and read it aloud",
      "Introduce yourself and hold simple conversations",
      "Talk about the past, present and future",
      "The grammar base every later phase builds on",
    ],
    pr: {
      heading: "Phase 1 is where PR French starts.",
      body: "You won't sit TEF or TCF yet. Every point on the exam depends on the grammar and pronunciation you build here, so students who rush this phase usually pay for it on exam day.",
    },
  },
  2: {
    videoUrl: "",
    tagline: "Stop studying French and start using it, in real tasks.",
    startsFrom: "A1–A2 grammar complete",
    finishesAt: "B1 readiness",
    leaveWith: [
      "Write messages, descriptions and opinion pieces",
      "Speak through role-plays and justify your opinions",
      "Follow conversations, announcements and interviews",
      "Hands-on experience with every TEF/TCF task type",
    ],
    pr: {
      heading: "Phase 2 turns grammar into exam-style skills.",
      body: "You'll practise the same writing and speaking task types that TEF Canada and TCF Canada use. That builds the base for NCLC 7, the level Express Entry rewards.",
    },
  },
  3: {
    videoUrl: "",
    tagline: "Timed practice, mock exams and corrections until you're ready.",
    startsFrom: "B1 across all four skills",
    finishesAt: "Exam day",
    leaveWith: [
      "Finish every task within the real time limits",
      "Several full mock exams, each with personal feedback",
      "A clear picture of your strengths and weak points",
      "A plan for your final weeks before the exam",
    ],
    pr: {
      heading: "Phase 3 is built around the score you need.",
      body: "For Express Entry, that usually means NCLC 7 in speaking, writing, listening and reading. Every mock is corrected against that target so you know where you stand before you book the real exam.",
    },
  },
};

/** What a Canada PR applicant needs, in order. Shown on every phase page. */
export const PR_STEPS = [
  {
    title: "Reach NCLC 7 in all four skills",
    body: "Speaking, writing, listening and reading each need to hit the mark. One weak skill holds back the rest.",
  },
  {
    title: "Sit TEF Canada or TCF Canada",
    body: "Both are accepted by IRCC. Results stay valid for two years from the test date.",
  },
  {
    title: "Add your French score to Express Entry",
    body: "Strong French adds up to 50 extra CRS points and makes you eligible for French-language category draws.",
  },
];

/** Accepts common YouTube URL shapes and returns the privacy-friendly embed URL. */
export function toYouTubeEmbed(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0` : null;
}
