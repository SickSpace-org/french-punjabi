import {
  GraduationCap,
  TrendingUp,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";

type Stat = {
  icon: LucideIcon;
  label: string;
  caption?: string;
} & (
  | { kind: "count"; value: number; suffix: string }
  | { kind: "text"; value: string }
);

const STATS: Stat[] = [
  {
    icon: GraduationCap,
    label: "Students Trained",
    kind: "count",
    value: 100,
    suffix: "+",
  },
  {
    icon: TrendingUp,
    label: "Exam Success Rate",
    kind: "count",
    value: 90,
    suffix: "%+",
  },
  {
    icon: UserCheck,
    label: "Teachers",
    caption: "Proven Results",
    kind: "text",
    value: "Expert",
  },
];

const panelShell =
  "laminate mx-auto w-full max-w-[1000px] rounded-2xl border border-navy/10 p-6 transition-all duration-300 hover:-translate-y-1 sm:p-8";

export default function AudienceAndResults() {
  return (
    <section
      id="our-results"
      className="bg-gradient-to-b from-white to-cream py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Our Results Speak */}
        <Reveal>
          <div className={`${panelShell} hover:border-blue/20`}>
            <h3 className="text-center font-display text-xl font-bold uppercase tracking-wide text-red-dark sm:text-2xl">
              Our Results Speak
            </h3>

            <div className="mt-6 grid grid-cols-1 divide-y divide-navy/8 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {STATS.map((stat, index) => {
                const base = index * 100;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center justify-center gap-1 px-2 py-4 text-center first:pt-0 sm:px-6 sm:py-0"
                  >
                    <Reveal variant="icon" delayMs={150 + base}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-soft text-blue shadow-sm">
                        <stat.icon className="h-4.5 w-4.5" strokeWidth={2} />
                      </span>
                    </Reveal>

                    <div className="mt-1">
                      {stat.kind === "count" ? (
                        <CountUp
                          end={stat.value}
                          suffix={stat.suffix}
                          delayMs={350 + base}
                          className="font-display text-3xl font-bold text-navy"
                        />
                      ) : (
                        <Reveal variant="scale" delayMs={350 + base}>
                          <span className="font-display text-3xl font-bold text-navy">
                            {stat.value}
                          </span>
                        </Reveal>
                      )}
                    </div>

                    <Reveal variant="fade" delayMs={550 + base}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">
                        {stat.label}
                      </p>
                      {stat.caption ? (
                        <p className="text-[11px] font-medium text-navy/40">
                          {stat.caption}
                        </p>
                      ) : null}
                    </Reveal>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
