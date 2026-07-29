/**
 * Single source of truth for the Syllabus page — curriculum content only.
 * No pricing, timings, or enrollment data belongs here; that lives in
 * courses.ts. Icon values are string keys resolved against the shared map
 * in components/syllabus/icons.ts, keeping this file plain/serializable.
 */

export type IconKey =
  | "type"
  | "book"
  | "check"
  | "pen"
  | "mic"
  | "headphones"
  | "users"
  | "target"
  | "clock"
  | "clipboard"
  | "layers"
  | "sparkles"
  | "graduationCap";

export type CurriculumSection = {
  icon: IconKey;
  title: string;
  intro?: string;
  items?: string[];
  outro?: string;
};

export type SyllabusLevel = {
  id: string;
  label: string;
  title: string;
  subtitle?: string;
  entryProfile?: string;
  summary: string;
  sections: CurriculumSection[];
};

export type PhaseMeta = {
  id: string;
  code: string;
  heading: string;
  subheading: string;
  badge?: string;
  objective: string;
  note?: string;
};

export const HERO_INDICATORS = [
  { icon: "sparkles" as IconKey, value: "7 Months" },
  { icon: "layers" as IconKey, value: "3 Phases" },
  { icon: "graduationCap" as IconKey, value: "5 Progressive Levels" },
  { icon: "target" as IconKey, value: "4 Core Skills" },
];

export const PROGRESSION_STEPS = [
  "A1 Foundation",
  "A2 Communication",
  "B1 Readiness",
  "Exam Preparation",
];

export const CURRICULUM_GOALS = [
  {
    number: "01",
    icon: "type" as IconKey,
    title: "Strong Foundation",
    body: "Develop French pronunciation, sentence structure, vocabulary, and grammar.",
  },
  {
    number: "02",
    icon: "users" as IconKey,
    title: "Confident Communication",
    body: "Progress from zero/basic knowledge toward confident A1–A2 communication.",
  },
  {
    number: "03",
    icon: "mic" as IconKey,
    title: "Speaking & Writing",
    body: "Develop structured speaking and writing for practical communication and exam-style tasks.",
  },
  {
    number: "04",
    icon: "headphones" as IconKey,
    title: "Listening & Reading",
    body: "Build comprehension through everyday French and exam-style materials.",
  },
  {
    number: "05",
    icon: "target" as IconKey,
    title: "Exam Readiness",
    body: "Prepare eligible B1-level learners for intensive practice through timed tasks, mock tests, corrections, and feedback.",
  },
];

export const PHASE_META: PhaseMeta[] = [
  {
    id: "syllabus-phase-1",
    code: "Phase 01",
    heading: "Build Your French Foundation",
    subheading: "Foundation & Grammar Development",
    badge: "3 Levels",
    objective:
      "Build a complete grammatical and pronunciation foundation so students can understand and produce simple French accurately.",
    note: "This phase is suitable for complete beginners as well as students who already have basic exposure to French conjugation.",
  },
  {
    id: "syllabus-phase-2",
    code: "Phase 02",
    heading: "Turn French Into Communication",
    subheading: "Practical Application & Task-Based Learning",
    badge: "2 Levels",
    objective:
      "Shift students from grammar knowledge into practical performance through structured speaking, writing, listening, and reading activities connected to real-life situations and TCF-style tasks.",
  },
  {
    id: "syllabus-phase-3",
    code: "Phase 03",
    heading: "Prepare for Exam Performance",
    subheading: "Practice Phase & Exam Preparation",
    objective:
      "Prepare students for exam performance through intensive practice, feedback, mock tests, correction strategies, and time management.",
  },
];

export const PHASE_1_LEVELS: SyllabusLevel[] = [
  {
    id: "p1-level-1",
    label: "Level 1",
    title: "A1 Starter",
    subtitle: "From Zero to Basic French",
    entryProfile: "Students starting from zero or with very limited French knowledge.",
    summary: "The French alphabet, pronunciation, and your first simple sentences.",
    sections: [
      {
        icon: "type",
        title: "Core Focus",
        items: [
          "French alphabet",
          "Pronunciation",
          "French accents",
          "Basic sentence formation",
          "Greetings",
          "Introductions",
          "Numbers",
          "Days",
          "Months",
          "Classroom vocabulary",
        ],
      },
      {
        icon: "book",
        title: "Grammar",
        items: [
          "Subject pronouns",
          "Articles",
          "Gender and number",
          "Present tense basics",
          "Être",
          "Avoir",
          "Aller",
          "Faire",
          "Regular -ER verbs",
        ],
      },
      {
        icon: "check",
        title: "Skill Outcomes",
        intro: "Students develop the ability to:",
        items: [
          "Introduce themselves",
          "Ask and answer simple personal questions",
          "Read short basic texts",
          "Write short sentences about familiar topics",
        ],
      },
    ],
  },
  {
    id: "p1-level-2",
    label: "Level 2",
    title: "A1 Grammar Expansion",
    subtitle: "Conjugation & Sentence Building",
    entryProfile:
      "Students who have completed regular -ER verbs and understand basic conjugation concepts.",
    summary: "Expanding vocabulary and building complete sentences for everyday communication.",
    sections: [
      {
        icon: "type",
        title: "Core Focus",
        intro:
          "Expand vocabulary and build more complete sentences for everyday communication.",
      },
      {
        icon: "book",
        title: "Grammar",
        items: [
          "-IR verbs",
          "-RE verbs",
          "Common irregular verbs",
          "Negation",
          "Questions",
          "Possessive adjectives",
          "Demonstrative adjectives",
          "Prepositions",
          "Adjective agreement",
          "Basic time expressions",
        ],
      },
      {
        icon: "check",
        title: "Skill Outcomes",
        intro: "Students develop the ability to describe:",
        items: ["People", "Routines", "Preferences", "Places", "Simple events"],
        outro: "using present-tense structures with improved accuracy.",
      },
    ],
  },
  {
    id: "p1-level-3",
    label: "Level 3",
    title: "A1–A2 Grammar Recap",
    subtitle: "Complete Grammar Foundation",
    summary: "Consolidating grammar and preparing to transition into practical French.",
    sections: [
      {
        icon: "type",
        title: "Core Focus",
        intro: "Consolidate foundational grammar and prepare for A2-level communication.",
      },
      {
        icon: "book",
        title: "Grammar",
        items: [
          "Passé composé",
          "Introduction to imparfait",
          "Futur proche",
          "Introduction to futur simple",
          "Reflexive verbs",
          "Pronouns",
          "Comparatives",
          "Superlatives",
          "Connectors",
          "Essential moods where appropriate",
        ],
      },
      {
        icon: "users",
        title: "Communication",
        intro: "Students learn to:",
        items: [
          "Narrate simple past events",
          "Describe habits",
          "Make plans",
          "Give reasons",
          "Express preferences",
          "Connect ideas",
        ],
      },
      {
        icon: "check",
        title: "Skill Outcome",
        intro:
          "Students complete their foundational grammar recap and prepare to transition from grammar-focused learning into practical speaking and writing.",
      },
    ],
  },
];

export const PHASE_2_LEVELS: SyllabusLevel[] = [
  {
    id: "p2-level-1",
    label: "Level 1",
    title: "Transition to Practical Communication",
    summary: "Applying grammar to real writing and speaking tasks for the first time.",
    sections: [
      {
        icon: "pen",
        title: "Writing",
        intro: "Introduction to Task 1 and Task 2 writing formats:",
        items: ["Short messages", "Invitations", "Responses", "Descriptions", "Structured paragraphs"],
      },
      {
        icon: "mic",
        title: "Speaking",
        intro: "Introduction to Task 1 and Task 2 speaking formats:",
        items: ["Personal presentation", "Guided questions", "Role-play", "Everyday interaction"],
      },
      {
        icon: "book",
        title: "Grammar Integration",
        intro:
          "Students begin reusing previously learned grammar in practical contexts instead of studying grammar only in isolation.",
      },
      {
        icon: "check",
        title: "Skill Outcomes",
        intro: "Students develop the ability to:",
        items: [
          "Produce short written responses",
          "Participate in simple conversations",
          "Ask questions",
          "Respond naturally",
          "Organize basic ideas",
        ],
      },
    ],
  },
  {
    id: "p2-level-2",
    label: "Level 2",
    title: "Full Practice",
    subtitle: "Task 3, Listening & Reading",
    summary: "Completing major task types while adding listening and reading practice.",
    sections: [
      {
        icon: "pen",
        title: "Writing",
        intro: "Task 3 writing practice:",
        items: ["Opinion-based responses", "Idea development", "Connectors", "Examples", "Basic argument structure"],
      },
      {
        icon: "mic",
        title: "Speaking",
        intro: "Task 3 speaking practice:",
        items: ["Expressing opinions", "Justifying answers", "Comparing options", "Giving reasons clearly"],
      },
      {
        icon: "headphones",
        title: "Listening",
        intro: "Practice using:",
        items: ["Short conversations", "Announcements", "Interviews", "Progressively more complex audio materials"],
      },
      {
        icon: "book",
        title: "Reading",
        intro: "Practice using:",
        items: ["Notices", "Messages", "Short articles", "Everyday texts", "Exam-style comprehension exercises"],
      },
      {
        icon: "check",
        title: "Skill Outcome",
        intro:
          "Students begin completing major speaking and writing task types while integrating listening and reading into a complete exam-preparation routine.",
      },
    ],
  },
];

export const PHASE_3_ELIGIBILITY =
  "This phase is intended for students who have already completed B1-level preparation and understand all four modules: Speaking, Writing, Listening, and Reading.";

export const PHASE_3_PRACTICE: CurriculumSection[] = [
  {
    icon: "pen",
    title: "Writing Practice",
    items: [
      "Timed Tasks 1, 2 and 3",
      "Structure correction",
      "Grammar correction",
      "Vocabulary improvement",
      "Coherence",
      "Word-count control",
    ],
  },
  {
    icon: "mic",
    title: "Speaking Practice",
    items: [
      "Mock speaking interviews",
      "Pronunciation correction",
      "Fluency building",
      "Response organization",
      "Individual feedback",
    ],
  },
  {
    icon: "headphones",
    title: "Listening Practice",
    items: [
      "Timed listening drills",
      "Answer-analysis sessions",
      "Keyword recognition",
      "Progressive difficulty practice",
    ],
  },
  {
    icon: "book",
    title: "Reading Practice",
    items: [
      "Timed reading comprehension",
      "Scanning strategies",
      "Vocabulary development",
      "Question-type practice",
    ],
  },
  {
    icon: "target",
    title: "Mock Exams",
    intro: "Use full and partial mock tests to develop:",
    items: ["Stamina", "Confidence", "Time management", "Exam-day readiness"],
  },
];

export type RoadmapPhaseBand = {
  id: string;
  label: string;
  months: string;
  title: string;
  tone: "navy" | "red";
};

export const ROADMAP_PHASE_BANDS: RoadmapPhaseBand[] = [
  { id: "phase-1", label: "Phase 1", months: "Months 1–3", title: "Foundation", tone: "navy" },
  { id: "phase-2", label: "Phase 2", months: "Months 4–5", title: "Application", tone: "red" },
  { id: "phase-3", label: "Phase 3", months: "Months 6–7", title: "Exam Preparation", tone: "navy" },
];

export type RoadmapMonth = {
  id: string;
  label: string;
  tag: string;
  focus: string[];
  outcome: string;
  tone: "navy" | "red";
};

export const ROADMAP_MONTHS: RoadmapMonth[] = [
  {
    id: "month-1",
    label: "Month 1",
    tag: "Phase 1 — Level 1",
    focus: ["Pronunciation", "Alphabet", "Basic grammar", "-ER verbs", "Basic vocabulary"],
    outcome: "Students begin introducing themselves and forming simple present-tense sentences.",
    tone: "navy",
  },
  {
    id: "month-2",
    label: "Month 2",
    tag: "Phase 1 — Level 2",
    focus: ["Expanded conjugation", "Sentence structure", "Questions", "Negation", "Adjectives"],
    outcome: "Students develop the ability to describe routines, people, places, and preferences.",
    tone: "navy",
  },
  {
    id: "month-3",
    label: "Month 3",
    tag: "Phase 1 — Level 3",
    focus: ["Grammar recap", "Past structures", "Future structures", "Pronouns", "Connectors"],
    outcome: "Students complete the A1–A2 grammar foundation.",
    tone: "navy",
  },
  {
    id: "month-4",
    label: "Month 4",
    tag: "Phase 2 — Level 1",
    focus: ["Task 1 and Task 2 writing", "Task 1 and Task 2 speaking"],
    outcome: "Students begin applying grammar in practical communication tasks.",
    tone: "red",
  },
  {
    id: "month-5",
    label: "Month 5",
    tag: "Phase 2 — Level 2",
    focus: ["Task 3 writing", "Task 3 speaking", "Listening", "Reading"],
    outcome: "Students begin attempting major task types with guided support.",
    tone: "red",
  },
  {
    id: "month-6-7",
    label: "Months 6–7",
    tag: "Phase 3",
    focus: ["Exam preparation", "Mock tests", "Corrections", "Timed practice"],
    outcome: "Students work on improving accuracy, fluency, confidence, and exam readiness.",
    tone: "navy",
  },
];

export const ASSESSMENT_CARDS = [
  {
    icon: "clock" as IconKey,
    title: "Weekly Checks",
    items: [
      "Short grammar quizzes",
      "Vocabulary reviews",
      "Pronunciation checks",
      "Mini speaking tasks",
    ],
  },
  {
    icon: "clipboard" as IconKey,
    title: "Monthly Evaluations",
    items: [
      "Writing assignments",
      "Speaking recordings",
      "Listening comprehension tests",
      "Reading exercises",
    ],
  },
  {
    icon: "users" as IconKey,
    title: "Personalized Feedback",
    intro: "Feedback focuses on:",
    items: [
      "Grammar accuracy",
      "Pronunciation",
      "Vocabulary range",
      "Sentence structure",
      "Coherence",
      "Fluency",
      "Task completion",
    ],
  },
  {
    icon: "target" as IconKey,
    title: "Final Readiness Review",
    body: "Students complete timed mock tasks and receive personalized feedback before entering final exam-focused preparation.",
  },
];

export const COMPLETION_INTRO = [
  "By the end of the 7-month intensive program, students should have developed a complete foundation in French grammar, practical experience with speaking and writing tasks, exposure to listening and reading practice, and a clear understanding of exam expectations.",
  "Students entering Phase 3 with a completed B1 foundation can then focus on refining their performance through intensive exam practice and feedback.",
];

export const COMPLETION_OUTCOMES = [
  { icon: "type" as IconKey, title: "Grammar", caption: "Complete Foundation" },
  { icon: "mic" as IconKey, title: "Speaking", caption: "Practical Communication" },
  { icon: "pen" as IconKey, title: "Writing", caption: "Structured Responses" },
  { icon: "headphones" as IconKey, title: "Listening", caption: "Comprehension Practice" },
  { icon: "book" as IconKey, title: "Reading", caption: "Reading Strategies" },
  { icon: "target" as IconKey, title: "Exam Prep", caption: "Focused Practice" },
];
