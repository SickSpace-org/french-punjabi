/**
 * Single source of truth for the Team page. Photos and bios are
 * placeholders — replace `photo` with a path under /public/images/ and
 * update the copy once the real team details are ready.
 */

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo?: string;
};

export const TEAM_MEMBERS: TeamMember[] = [
  {
    id: "member-1",
    name: "Teacher Name",
    role: "Founder & Lead French Trainer",
    bio: "[ Editable placeholder — add a short bio covering teaching background and specialty. ]",
  },
  {
    id: "member-2",
    name: "Teacher Name",
    role: "TEF / TCF Exam Specialist",
    bio: "[ Editable placeholder — add a short bio covering teaching background and specialty. ]",
  },
  {
    id: "member-3",
    name: "Teacher Name",
    role: "Foundation Levels Coordinator",
    bio: "[ Editable placeholder — add a short bio covering teaching background and specialty. ]",
  },
  {
    id: "member-4",
    name: "Teacher Name",
    role: "Native Batch Instructor",
    bio: "[ Editable placeholder — add a short bio covering teaching background and specialty. ]",
  },
  {
    id: "member-5",
    name: "Teacher Name",
    role: "Student Success & Enrollment",
    bio: "[ Editable placeholder — add a short bio covering teaching background and specialty. ]",
  },
];
