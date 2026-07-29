import {
  BookOpen,
  CheckCircle2,
  Clock,
  ClipboardList,
  GraduationCap,
  Headphones,
  Layers,
  Mic,
  PenLine,
  Sparkles,
  Target,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { IconKey } from "@/data/syllabus";

export const SYLLABUS_ICONS: Record<IconKey, LucideIcon> = {
  type: Type,
  book: BookOpen,
  check: CheckCircle2,
  pen: PenLine,
  mic: Mic,
  headphones: Headphones,
  users: Users,
  target: Target,
  clock: Clock,
  clipboard: ClipboardList,
  layers: Layers,
  sparkles: Sparkles,
  graduationCap: GraduationCap,
};
