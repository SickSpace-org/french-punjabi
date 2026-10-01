import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  MessageCircleMore,
  PiggyBank,
  PlayCircle,
  ShieldCheck,
  Sun,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";

type Glance = { icon: LucideIcon; value: number; prefix?: string; suffix?: string; text?: string; label: string };

/** The four numbers a student cares about most, readable in one glance. */
const AT_A_GLANCE: Glance[] = [
  { icon: Users, value: 8, text: "4–8", label: "students per batch" },
  { icon: CalendarDays, value: 5, suffix: " days", label: "of classes a week" },
  { icon: MessageCircleMore, value: 24, prefix: "<", suffix: "h", label: "to answer your doubts" },
  { icon: ShieldCheck, value: 7, suffix: " days", label: "to try, full refund" },
];

type Pillar = {
  icon: LucideIcon;
  title: string;
  summary: string;
  header: string;
  iconTile: string;
  items: { icon: LucideIcon; title: string; body: string }[];
};

const PILLARS: Pillar[] = [
  {
    icon: GraduationCap,
    title: "Expert, exam-focused teaching",
    summary: "Learn only what the exam tests, from people who've passed it.",
    header: "bg-navy text-white",
    iconTile: "bg-white/15 text-white",
    items: [
      { icon: Award, title: "Certified mentors", body: "C1-certified trainers who explain every concept clearly." },
      { icon: Target, title: "100% TEF / TCF focused", body: "No time wasted on topics the exam never asks." },
      { icon: Users, title: "Small batches", body: "Only 4–8 students, so you speak in every class." },
      { icon: ClipboardCheck, title: "Everyday attendance", body: "Attendance is marked every class, so you stay regular and on track." },
    ],
  },
  {
    icon: Sun,
    title: "Classes that fit your life",
    summary: "Keep your job or studies and still learn every day.",
    header: "bg-red text-white",
    iconTile: "bg-white/15 text-white",
    items: [
      { icon: Sun, title: "Morning or evening", body: "Pick the batch timing that suits your day." },
      { icon: PlayCircle, title: "Recorded classes", body: "Missed a class? Watch the recording later." },
      { icon: CalendarDays, title: "Monday to Friday", body: "A steady routine that keeps your momentum." },
      { icon: PiggyBank, title: "Affordable classes", body: "Expert coaching at a fair price, with a monthly payment option." },
    ],
  },
  {
    icon: HeartHandshake,
    title: "Support, with zero risk",
    summary: "You're never stuck, and never locked in.",
    header: "bg-blue-soft text-navy",
    iconTile: "bg-white text-red",
    items: [
      { icon: MessageCircleMore, title: "Doubts answered in 24h", body: "Post in the group, get help within a day." },
      { icon: CalendarCheck, title: "Free Friday session", body: "15 minutes one-on-one, subject to availability." },
      { icon: Wallet, title: "Clear pricing", body: "No hidden charges. You see everything upfront." },
      { icon: ShieldCheck, title: "7-day money-back", body: "Not satisfied after 7 days? Full refund, per the program terms." },
    ],
  },
];

export default function WhyChooseUs() {
  return (
    <section id="why-us" className="relative overflow-hidden bg-cream py-20 lg:py-28">
      <div className="pointer-events-none absolute -top-16 left-0 h-72 w-72 rounded-full bg-blue-soft/60 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-red-soft/60 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red">Why AngrishFrançais</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-navy sm:text-5xl">
            Everything you need to pass, in one place.
          </h2>
          <p className="mt-4 text-lg text-navy/65">
            Expert teaching, flexible classes and real support, all in one program.
          </p>
        </Reveal>

        {/* At a glance */}
        <Reveal variant="scale" delayMs={100} className="mt-12">
          <div className="grid grid-cols-2 overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-xl shadow-navy/5 lg:grid-cols-4">
            {AT_A_GLANCE.map(({ icon: Icon, value, prefix, suffix, text, label }, i) => (
              <div
                key={label}
                className={`group flex items-center gap-4 p-5 transition-colors duration-300 hover:bg-cream sm:p-7 ${
                  i % 2 === 1 ? "border-l border-navy/8" : ""
                } ${i >= 2 ? "border-t border-navy/8 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
              >
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-soft text-red transition-all duration-300 group-hover:scale-110 group-hover:bg-red group-hover:text-white sm:flex">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  {text ? (
                    <span className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{text}</span>
                  ) : (
                    <CountUp
                      end={value}
                      prefix={prefix}
                      suffix={suffix}
                      delayMs={300 + i * 120}
                      duration={1200}
                      className="font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl"
                    />
                  )}
                  <p className="mt-0.5 text-sm text-navy/60">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Three pillars */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} variant="up" delayMs={150 + i * 130} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-navy/10">
                <header className={`relative overflow-hidden p-6 sm:p-7 ${pillar.header}`}>
                  <span className="pointer-events-none absolute -bottom-8 -right-2 font-display text-[7.5rem] font-bold leading-none opacity-10 transition-transform duration-700 group-hover:-translate-y-2 group-hover:scale-110">
                    0{i + 1}
                  </span>
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:rotate-[-8deg] ${pillar.iconTile}`}
                  >
                    <pillar.icon className="h-6 w-6" />
                  </span>
                  <h3 className="relative mt-5 font-display text-2xl font-semibold leading-tight">{pillar.title}</h3>
                  <p className="relative mt-1.5 text-sm opacity-75">{pillar.summary}</p>
                </header>

                <ul className="flex flex-1 flex-col divide-y divide-navy/8 px-6 sm:px-7">
                  {pillar.items.map(({ icon: Icon, title, body }, j) => (
                    <li
                      key={title}
                      className="flex gap-4 py-4 transition-transform duration-300 group-hover:translate-x-1"
                      style={{ transitionDelay: `${j * 60}ms` }}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream text-red">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div>
                        <p className="font-semibold text-navy">{title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-navy/60">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={200} className="mt-10 text-center">
          <Link
            href="/courses"
            className="group inline-flex items-center gap-2 rounded-full bg-navy px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-navy/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-navy-light"
          >
            See batches &amp; timings
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
