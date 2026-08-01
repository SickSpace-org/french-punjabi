import {
  Award,
  CalendarCheck,
  Check,
  CircleCheck,
  MessageCircleMore,
  Moon,
  PlayCircle,
  ShieldCheck,
  Sun,
  Target,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Reveal from "@/components/Reveal";

type Card = {
  tone: "blue" | "red";
  title: string;
  description: string;
  visual: React.ReactNode;
};

function IconTile({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-110 ${tone}`}
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}

const TRANSPARENCY_ITEMS = ["Clear Pricing", "Clear Syllabus", "Clear Schedule"];
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"];

const CARDS: Card[] = [
  {
    tone: "blue",
    title: "Certified Mentors",
    description:
      "C1-certified trainers explain concepts clearly and share practical, real-life learning strategies.",
    visual: (
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-soft text-blue ring-1 ring-blue/15">
            <Award className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue text-white ring-2 ring-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-blue">
          Certified
        </span>
      </div>
    ),
  },
  {
    tone: "red",
    title: "No Time Wasted",
    description:
      "100% exam-oriented training focused on TEF/TCF so students can focus on what actually matters.",
    visual: (
      <div className="relative mx-auto h-[92px] w-[92px]">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-navy/12" />
        <div className="absolute inset-3 rounded-full bg-blue-soft" />
        <div className="absolute inset-7 flex items-center justify-center rounded-full bg-blue text-white shadow-sm">
          <Target className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <span className="absolute -left-1 -top-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red shadow-sm ring-1 ring-red/15">
          TEF
        </span>
        <span className="absolute -bottom-1 -left-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red shadow-sm ring-1 ring-red/15">
          TCF
        </span>
      </div>
    ),
  },
  {
    tone: "red",
    title: "Affordable Learning",
    description: "High-quality French training at an accessible price.",
    visual: (
      <div className="text-center">
        <p className="font-display text-2xl font-bold tracking-tight text-red sm:text-[1.75rem]">
          Affordable
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-navy/40">
          Complete Program
        </p>
        <span className="mt-3 inline-flex rounded-full bg-red-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red">
          7 Months
        </span>
      </div>
    ),
  },
  {
    tone: "blue",
    title: "Complete Transparency",
    description:
      "No hidden charges. Clear syllabus, batch details, schedules, and teacher information.",
    visual: (
      <div className="rounded-xl border border-navy/8 bg-white/80 p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red/60" />
          <span className="h-1.5 w-1.5 rounded-full bg-navy/15" />
          <span className="h-1.5 w-1.5 rounded-full bg-navy/15" />
        </div>
        <ul className="space-y-1.5">
          {TRANSPARENCY_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CircleCheck className="h-3.5 w-3.5 shrink-0 text-blue" strokeWidth={2} />
              <span className="text-xs font-medium text-navy/70">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    tone: "red",
    title: "Money-Back Guarantee",
    description:
      "Join and attend classes for 3 days. If you're not satisfied, receive a full refund according to the program terms.",
    visual: (
      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <ShieldCheck
          className="absolute inset-0 h-full w-full text-red-soft"
          strokeWidth={1.25}
        />
        <div className="relative text-center">
          <p className="font-display text-2xl font-bold leading-none text-red">
            3
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-red/70">
            Days
          </p>
        </div>
      </div>
    ),
  },
  {
    tone: "blue",
    title: "Small Batches",
    description:
      "Only 9–10 students in grammar batches for personal attention and better interaction.",
    visual: (
      <div className="text-center">
        <p className="font-display text-4xl font-bold text-navy">9–10</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
          Students
        </p>
        <div className="mt-3 flex justify-center -space-x-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-soft text-blue ring-2 ring-white"
            >
              <User className="h-3 w-3" strokeWidth={2.25} />
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    tone: "blue",
    title: "Flexible Schedule",
    description:
      "Morning and evening batches plus access to recorded classes.",
    visual: (
      <div className="space-y-2">
        <div className="flex items-center gap-2.5 rounded-xl bg-cream-dim px-3 py-2">
          <IconTile icon={Sun} tone="bg-white text-blue" />
          <span className="text-xs font-semibold text-navy/75">
            Morning Batch
          </span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-cream-dim px-3 py-2">
          <IconTile icon={Moon} tone="bg-white text-navy" />
          <span className="text-xs font-semibold text-navy/75">
            Evening Batch
          </span>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <PlayCircle className="h-3.5 w-3.5 text-red" strokeWidth={2} />
          <span className="text-[11px] font-medium text-navy/50">
            Recorded Classes Available
          </span>
        </div>
      </div>
    ),
  },
  {
    tone: "blue",
    title: "Five-Day Classes",
    description: "Structured French classes from Monday to Friday.",
    visual: (
      <div className="overflow-hidden rounded-xl border border-navy/8">
        <div className="bg-cream-dim px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-navy/40">
          This Week
        </div>
        <div className="grid grid-cols-5 divide-x divide-navy/8 bg-white/70">
          {WEEKDAYS.map((day) => (
            <div key={day} className="flex flex-col items-center gap-1 py-2.5">
              <span className="text-[9px] font-bold text-navy/45">{day}</span>
              <CircleCheck className="h-3.5 w-3.5 text-blue" strokeWidth={2.25} />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    tone: "red",
    title: "24-Hour Support",
    description:
      "Students can post their doubts in the group and receive support within 24 hours.",
    visual: (
      <div className="relative flex flex-col items-center justify-center py-1">
        <div className="pointer-events-none absolute -top-1 right-1 flex flex-col items-end gap-1 opacity-25">
          <span className="h-1 w-8 rounded-full bg-navy/40" />
          <span className="h-1 w-5 rounded-full bg-navy/40" />
        </div>
        <MessageCircleMore className="h-6 w-6 text-red" strokeWidth={2} />
        <p className="mt-1 font-display text-2xl font-bold text-navy">
          &lt;24H
        </p>
      </div>
    ),
  },
  {
    tone: "red",
    title: "Free Private Session",
    description:
      "One free 15-minute private session every Friday, subject to availability.",
    visual: (
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-red-soft text-red">
            <CalendarCheck className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-navy shadow-sm ring-2 ring-white">
            <UserRound className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </div>
        <div>
          <p className="font-display text-xl font-bold text-navy">
            15{" "}
            <span className="text-sm font-semibold text-navy/50">Min</span>
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            Friday
          </p>
        </div>
      </div>
    ),
  },
];

const TONE_BORDER: Record<Card["tone"], string> = {
  blue: "hover:border-blue/25",
  red: "hover:border-red/25",
};

export default function WhyChooseUs() {
  return (
    <section id="why-us" className="relative overflow-hidden bg-cream py-24 lg:py-28">
      <div className="pointer-events-none absolute -top-16 left-0 h-72 w-72 rounded-full bg-blue-soft/60 blur-3xl" />
      <div className="pointer-events-none absolute -top-10 right-0 h-72 w-72 rounded-full bg-red-soft/50 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-blue-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue">
            Why Us
          </span>
          <h2 className="mt-5 font-display text-3xl font-semibold uppercase tracking-tight text-navy sm:text-4xl">
            Why Students Choose AngrishFrançais
          </h2>
          <p className="mt-4 text-base text-navy/60">
            Designed to make your French learning focused, flexible, and
            effective.
          </p>
          <div className="mx-auto mt-6 flex items-center justify-center gap-2">
            <span className="h-px w-10 bg-navy/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue to-red" />
            <span className="h-px w-10 bg-navy/15" />
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {CARDS.map((card, index) => (
            <Reveal
              key={card.title}
              variant="scale"
              delayMs={index * 85}
              className="h-full"
            >
              <div
                className={`laminate group relative flex h-full min-h-[350px] flex-col rounded-2xl border border-navy/10 p-6 transition-all duration-300 hover:-translate-y-1 ${TONE_BORDER[card.tone]}`}
              >
                <Reveal
                  variant="icon"
                  delayMs={index * 85 + 120}
                  durationMs={500}
                  className="relative z-[1]"
                >
                  <div className="transition-transform duration-300 ease-out group-hover:scale-[1.03]">
                    {card.visual}
                  </div>
                </Reveal>

                <h3 className="relative z-[1] mt-6 font-display text-base font-bold uppercase tracking-wide text-red-dark">
                  {card.title}
                </h3>
                <p className="relative z-[1] mt-2 text-sm leading-relaxed text-navy/60">
                  {card.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
