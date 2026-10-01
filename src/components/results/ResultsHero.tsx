import Image from "next/image";
import Link from "next/link";
import { ArrowDown, BadgeCheck } from "lucide-react";
import CountUp from "@/components/CountUp";
import { STUDENT_RESULTS } from "@/data/results";

const FAN = [
  "-rotate-[10deg] -translate-x-[42%] translate-y-4 group-hover:-rotate-[16deg] group-hover:-translate-x-[62%]",
  "rotate-[10deg] translate-x-[42%] translate-y-4 group-hover:rotate-[16deg] group-hover:translate-x-[62%]",
  "rotate-0 -translate-y-2 group-hover:-translate-y-5 group-hover:scale-105",
];

export default function ResultsHero() {
  const certs = STUDENT_RESULTS.filter((r) => r.photo);
  const fan = certs.slice(0, 3);
  const tefCount = certs.filter((r) => `${r.name} ${r.batch}`.includes("TEF")).length;
  const tcfCount = certs.filter((r) => `${r.name} ${r.batch}`.includes("TCF")).length;

  const stats = [
    { value: 100, suffix: "+", label: "Students trained" },
    { value: 90, suffix: "%+", label: "Exam success rate" },
    { value: tefCount, suffix: "", label: "TEF results shown" },
    { value: tcfCount, suffix: "", label: "TCF results shown" },
  ];

  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div className="bg-dot-grid-light pointer-events-none absolute inset-0" />
      <div className="hero-blob pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-red/35 blur-3xl" />
      <div className="hero-blob pointer-events-none absolute -bottom-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-blue/30 blur-3xl [animation-delay:-8s]" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-24 lg:pt-20">
        <div>
          <p className="program-rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/75">
            <BadgeCheck className="h-4 w-4 text-blue-soft" />
            Official TEF &amp; TCF Canada results
          </p>
          <h1 className="program-rise mt-6 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight [animation-delay:80ms] sm:text-6xl">
            Real students.
            <br />
            <span className="italic text-blue-soft/90">Real scores.</span>
          </h1>
          <p className="program-rise mt-6 max-w-lg text-lg leading-relaxed text-white/70 [animation-delay:160ms]">
            Every certificate on this page is an official result sheet from a student who
            prepared with AngrishFrançais. No stock photos.
          </p>

          <dl className="program-rise mt-10 grid max-w-lg grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 [animation-delay:240ms] sm:grid-cols-4 lg:max-w-none">
            {stats.map((s, i) => (
              <div key={s.label} className="flex flex-col-reverse bg-navy-light/70 p-4">
                <dt className="mt-1 text-xs text-white/60">{s.label}</dt>
                <dd>
                  <CountUp
                    end={s.value}
                    suffix={s.suffix}
                    delayMs={400 + i * 120}
                    duration={1400}
                    className="font-display text-3xl font-semibold"
                  />
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href="#certificates"
            className="program-rise group mt-9 inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors [animation-delay:320ms] hover:text-white"
          >
            Browse the certificates
            <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-1" />
          </Link>
        </div>

        {/* Fanned certificates: spread further apart on hover */}
        <div className="program-rise group relative mx-auto h-[22rem] w-full max-w-md [animation-delay:200ms] sm:h-[26rem]">
          {fan.map((r, i) => (
            <div
              key={r.id}
              className={`absolute left-1/2 top-1/2 w-44 -ml-22 -mt-32 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:w-52 sm:-ml-26 sm:-mt-36 ${FAN[i]}`}
              style={{ zIndex: i === 2 ? 3 : 1 }}
            >
              <div className="rounded-xl bg-white p-2 shadow-2xl shadow-black/40">
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-white">
                  <Image src={r.photo!} alt="" fill sizes="208px" className="object-contain" priority={i === 2} />
                </div>
                <p className="px-1 pb-0.5 pt-2 text-xs font-semibold text-navy">{r.name}</p>
              </div>
            </div>
          ))}
          <div className="animate-float absolute bottom-0 right-2 z-10 flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 text-navy shadow-xl shadow-black/30 sm:right-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red text-white">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Verified results</p>
              <p className="text-xs text-navy/55">Tap any to view full size</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
