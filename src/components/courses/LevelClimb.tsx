"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Pin, Play, Target } from "lucide-react";
import { courseHref } from "@/lib/courseNav";

/**
 * Interactive 7-month climb at the top of /courses. Each month is a bar
 * whose height is the French level you reach by the end of it; the bars
 * rise in sequence when the chart scrolls into view, a line traces their
 * tops up to exam day, and the months auto-play until the visitor picks
 * one. Autoplay pauses while the pointer is over the panel, and clicking a
 * month (or dragging across the bars, or resting the pointer on one) or the
 * detail card pins it so its buttons stay put. Months 6–7
 * switch between TEF Canada and TCF Canada.
 */

type Exam = "tef" | "tcf";

type Month = {
  month: number;
  phase: number;
  /** Level within the phase, for jumping straight to its batches. Months 6–7 depend on the exam. */
  level: number | Record<Exam, number>;
  title: string;
  line: string | Record<Exam, string>;
  tag: string;
  /** Bar height, as a percentage of the chart. */
  height: number;
};

const MONTHS: Month[] = [
  { month: 1, phase: 1, level: 1, title: "French Starter", line: "Your first words, sounds and sentences.", tag: "A1", height: 16 },
  { month: 2, phase: 1, level: 2, title: "Grammar Expansion", line: "Build real everyday sentences with confidence.", tag: "A1+", height: 28 },
  { month: 3, phase: 1, level: 3, title: "Grammar Recap", line: "Past, future and linking your ideas together.", tag: "A2", height: 40 },
  { month: 4, phase: 2, level: 1, title: "Practical French", line: "Speak and write through real-life tasks.", tag: "A2+", height: 53 },
  { month: 5, phase: 2, level: 2, title: "Full Practice", line: "All four skills, every exam task type.", tag: "B1", height: 66 },
  {
    month: 6,
    phase: 3,
    level: { tef: 1, tcf: 2 },
    title: "Exam Practice",
    line: { tef: "Timed TEF Canada tasks, section by section.", tcf: "Timed TCF Canada tasks, section by section." },
    tag: "B1+",
    height: 80,
  },
  {
    month: 7,
    phase: 3,
    level: { tef: 1, tcf: 2 },
    title: "Mock Exams",
    line: { tef: "Full TEF mocks under exam conditions, then corrections.", tcf: "Full TCF mocks under exam conditions, then corrections." },
    tag: "Exam",
    height: 93,
  },
];

const PHASES = [
  { n: 1, name: "Foundation", span: 3 },
  { n: 2, name: "Practice", span: 2 },
  { n: 3, name: "Exam", span: 2 },
];

const GUIDES = [
  { label: "A1", at: 16 },
  { label: "A2", at: 40 },
  { label: "B1", at: 66 },
  { label: "NCLC 7", at: 93 },
];

const AUTOPLAY_MS = 3600;

const pick = <T,>(v: T | Record<Exam, T>, exam: Exam): T =>
  typeof v === "object" && v !== null && "tef" in (v as object) ? (v as Record<Exam, T>)[exam] : (v as T);

export default function LevelClimb() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [active, setActive] = useState(0);
  const [exam, setExam] = useState<Exam>("tef");
  const [autoplay, setAutoplay] = useState(true);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Walk through the months on its own until the visitor takes over.
  useEffect(() => {
    if (!inView || !autoplay || hovering) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setActive((i) => (i + 1) % MONTHS.length), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [inView, autoplay, hovering, active]);

  const choose = useCallback((i: number) => {
    setAutoplay(false);
    setActive(i);
  }, []);

  // Drag across the bars to scrub through the months. Hovering a bar selects
  // it straight away; only a fast sweep across the bars (e.g. heading for the
  // card's buttons) waits a beat, so it doesn't flip through every month.
  const barsRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const lastMove = useRef({ x: 0, t: 0 });

  const indexAt = (clientX: number) => {
    const rect = barsRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return active;
    const i = Math.floor(((clientX - rect.left) / rect.width) * MONTHS.length);
    return Math.min(MONTHS.length - 1, Math.max(0, i));
  };

  const onBarsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    choose(indexAt(e.clientX));
  };

  const onBarsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const i = indexAt(e.clientX);
    if (dragging.current) {
      if (i !== active) choose(i);
      return;
    }
    if (e.pointerType !== "mouse") return;
    const now = e.timeStamp;
    const speed = Math.abs(e.clientX - lastMove.current.x) / Math.max(1, now - lastMove.current.t);
    lastMove.current = { x: e.clientX, t: now };
    window.clearTimeout(hoverTimer.current);
    if (i === active) return;
    if (speed < 1.5) choose(i);
    else hoverTimer.current = window.setTimeout(() => choose(i), 120);
  };

  const endDrag = () => {
    dragging.current = false;
  };

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") choose(Math.min(active + 1, MONTHS.length - 1));
    else if (e.key === "ArrowLeft") choose(Math.max(active - 1, 0));
  };

  const m = MONTHS[active];
  const level = pick(m.level, exam);
  const line = pick(m.line, exam);
  const examName = exam === "tef" ? "TEF Canada" : "TCF Canada";
  const points = MONTHS.map((mo, i) => `${(i + 0.5) * 100},${100 - mo.height}`).join(" ");

  return (
    <section className="bg-cream pb-16 pt-2 lg:pb-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div
          ref={rootRef}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className={`climb relative overflow-hidden rounded-[2rem] bg-navy text-white shadow-[0_40px_80px_-40px_rgba(11,28,57,0.6)] ${inView ? "is-on" : ""}`}
        >
          <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-red/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-blue/25 blur-3xl" />

          <div className="relative grid gap-10 p-6 sm:p-9 lg:grid-cols-[1.45fr_1fr] lg:gap-12 lg:p-11">
            {/* Chart */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white/55">Zero to exam day</p>
                  <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Your 7-month climb</h2>
                </div>
                <div role="group" aria-label="Exam you are preparing for" className="inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/15">
                  {(["tef", "tcf"] as Exam[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={exam === key}
                      onClick={() => setExam(key)}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                        exam === key ? "bg-white text-navy shadow" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {key.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex">
                <div className="min-w-0 flex-1">
                  {/* Phase bands */}
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5" aria-hidden="true">
                    {PHASES.map((p) => (
                      <p
                        key={p.n}
                        className={`truncate border-b-2 pb-1.5 text-[11px] sm:text-xs ${
                          m.phase === p.n ? "border-white text-white" : "border-white/15 text-white/45"
                        } transition-colors duration-500`}
                        style={{ gridColumn: `span ${p.span}` }}
                      >
                        <span className="font-semibold">Phase {p.n}</span>
                        <span className="hidden sm:inline"> · {p.name}</span>
                      </p>
                    ))}
                  </div>

                  {/* Bars */}
                  <div
                    role="tablist"
                    aria-label="Months of the program"
                    onKeyDown={onKey}
                    ref={barsRef}
                    onPointerDown={onBarsPointerDown}
                    onPointerMove={onBarsPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
                    className="relative mt-4 grid h-[260px] cursor-grab touch-pan-y select-none grid-cols-7 items-end active:cursor-grabbing"
                  >
                    {GUIDES.map((g) => (
                      <span
                        key={g.label}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/10"
                        style={{ bottom: `${g.at}%` }}
                      />
                    ))}

                    {MONTHS.map((mo, i) => {
                      const on = i === active;
                      const passed = i < active;
                      return (
                        <button
                          key={mo.month}
                          type="button"
                          role="tab"
                          aria-selected={on}
                          tabIndex={on ? 0 : -1}
                          aria-label={`Month ${mo.month}: ${mo.title}`}
                          onClick={() => choose(i)}
                          className="group/bar relative h-full cursor-[inherit] outline-none"
                        >
                          <span
                            className={`climb-bar absolute inset-x-[3px] bottom-0 sm:inset-x-[5px] flex flex-col items-center justify-start overflow-hidden rounded-t-xl pt-2 transition-[background-color,box-shadow] duration-500 group-focus-visible/bar:ring-2 group-focus-visible/bar:ring-white ${
                              on
                                ? mo.phase === 3 && exam === "tcf"
                                  ? "bg-gradient-to-t from-[#0f766e] to-[#34d3a8] shadow-[0_0_40px_-4px_rgba(52,211,168,0.6)]"
                                  : "bg-gradient-to-t from-red to-[#7aa2ff] shadow-[0_0_40px_-4px_rgba(122,162,255,0.65)]"
                                : passed
                                  ? "bg-white/25 group-hover/bar:bg-white/35"
                                  : "bg-white/10 group-hover/bar:bg-white/20"
                            }`}
                            style={{ height: `${mo.height}%`, animationDelay: `${i * 90}ms` }}
                          >
                            <span className={`font-display text-sm font-semibold sm:text-lg ${on ? "text-white" : "text-white/60"}`}>
                              {mo.month}
                            </span>

                          </span>
                        </button>
                      );
                    })}

                    {/* Line tracing the tops of the bars */}
                    <svg
                      viewBox="0 0 700 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                    >
                      <polyline
                        points={points}
                        className="climb-line"
                        fill="none"
                        stroke="#ffffff"
                        strokeOpacity="0.8"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>

                    {/* A dot on each bar top; the current month's glows */}
                    {MONTHS.map((mo, i) => (
                      <span
                        key={mo.month}
                        aria-hidden="true"
                        className={`climb-dot pointer-events-none absolute -translate-x-1/2 translate-y-1/2 rounded-full bg-white transition-all duration-500 ${
                          i === active ? "h-3.5 w-3.5 ring-[6px] ring-white/25" : "h-2 w-2"
                        }`}
                        style={{ left: `${((i + 0.5) / 7) * 100}%`, bottom: `${mo.height}%`, animationDelay: `${900 + i * 110}ms` }}
                      />
                    ))}

                    {/* Exam-day target */}
                    <span
                      aria-hidden="true"
                      className="climb-target pointer-events-none absolute flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-white text-navy shadow-lg"
                      style={{ left: `${(6.5 / 7) * 100}%`, bottom: `calc(${MONTHS[6].height}% + 14px)` }}
                    >
                      <Target className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                  </div>

                  <p className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] text-white/40 sm:gap-2.5 sm:text-xs" aria-hidden="true">
                    {MONTHS.map((mo) => (
                      <span key={mo.month}>M{mo.month}</span>
                    ))}
                  </p>
                </div>
              </div>
            </div>

            {/* Selected month */}
            <div
              aria-live="polite"
              onClick={() => setAutoplay(false)}
              onFocusCapture={() => setAutoplay(false)}
              className={`flex cursor-pointer flex-col rounded-3xl bg-white p-6 text-navy shadow-2xl shadow-black/30 ring-2 transition-shadow duration-300 sm:p-7 ${
                autoplay ? "ring-transparent" : "ring-[#7aa2ff]"
              }`}
            >
              <div key={`${active}-${exam}`} className="program-rise flex flex-1 flex-col">
                <div className="flex items-center justify-between gap-3 text-sm text-navy/55">
                  <span>
                    Phase {m.phase} · Month {m.month} of 7
                  </span>
                  {m.tag === "Exam" ? (
                    <span className="rounded-full bg-blue-soft px-2.5 py-0.5 text-xs font-semibold text-navy">Exam ready</span>
                  ) : null}
                </div>

                <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight">{m.title}</h3>
                {m.phase === 3 ? <p className="mt-1 text-sm font-semibold text-red">{examName}</p> : null}
                <p className="mt-3 leading-relaxed text-navy/65">{line}</p>

                <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-navy/10">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-red to-[#7aa2ff] transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ width: `${((active + 1) / MONTHS.length) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-navy/45">{Math.round(((active + 1) / MONTHS.length) * 100)}% of the way to exam day</p>

                <div className="mt-auto flex flex-wrap gap-3 pt-7">
                  <Link
                    href={courseHref(m.phase, level)}
                    className="group/cta inline-flex items-center gap-2 rounded-full bg-red px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-red/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-dark"
                  >
                    See batches
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" strokeWidth={2.5} />
                  </Link>
                  <Link
                    href={`/courses/phase-${m.phase}#syllabus`}
                    className="inline-flex items-center gap-2 rounded-full border border-navy/15 px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-dim"
                  >
                    <BookOpen className="h-4 w-4" strokeWidth={2} />
                    Syllabus
                  </Link>
                </div>
              </div>

              {autoplay ? (
                inView && !hovering ? (
                  <span key={`timer-${active}`} className="climb-timer mt-5 block h-0.5 origin-left rounded-full bg-navy/15" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
                ) : null
              ) : (
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-navy/10 pt-4 text-xs text-navy/55">
                  <span className="inline-flex items-center gap-1.5">
                    <Pin className="h-3.5 w-3.5 text-red" strokeWidth={2.5} />
                    Month {m.month} pinned
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAutoplay(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-navy/70 hover:bg-cream-dim hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                  >
                    <Play className="h-3 w-3" strokeWidth={2.5} />
                    Resume tour
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
