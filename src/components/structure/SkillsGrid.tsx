import { Headphones, Mic, PenLine, BookOpen, type LucideIcon } from "lucide-react";
import Reveal from "@/components/Reveal";

type Skill = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const SKILLS: Skill[] = [
  {
    icon: Mic,
    title: "Speaking",
    description: "Build confidence communicating in French.",
  },
  {
    icon: PenLine,
    title: "Writing",
    description: "Develop structured and practical written communication.",
  },
  {
    icon: Headphones,
    title: "Listening",
    description: "Improve comprehension through progressive practice.",
  },
  {
    icon: BookOpen,
    title: "Reading",
    description: "Develop understanding of everyday and exam-style French.",
  },
];

export default function SkillsGrid() {
  return (
    <section className="bg-white py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-red-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red">
            What Students Develop
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold uppercase tracking-wide text-navy sm:text-3xl">
            Four Core Skills, Built Progressively
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {SKILLS.map((skill, index) => (
            <Reveal key={skill.title} variant="scale" delayMs={index * 85}>
              <div className="laminate group flex h-full flex-col items-center rounded-2xl border border-navy/10 p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-blue/20">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-soft text-blue shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <skill.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="mt-4 font-display text-base font-bold uppercase tracking-wide text-red-dark">
                  {skill.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-navy/60">
                  {skill.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
