import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import CoursesOverview from "@/components/courses/CoursesOverview";
import LevelClimb from "@/components/courses/LevelClimb";
import { getPublicCourses } from "@/lib/courses/getPublicCourses";
import { courseHref } from "@/lib/courseNav";

export const metadata: Metadata = {
  title: "Courses | AngrishFrançais",
  description:
    "Three phases, seven months: from your first French word to TEF/TCF exam day. Pick a phase to see its levels, batch timings and fees.",
};

// Course data is admin-managed and can change at any time — always read
// fresh from the database rather than serving a stale cached render.
export const revalidate = 0;

type PageProps = {
  searchParams: Promise<{ phase?: string; level?: string }>;
};

export default async function CoursesPage({ searchParams }: PageProps) {
  // Old links (/courses?phase=2&level=1) now live on each phase's own page.
  const { phase, level } = await searchParams;
  if (phase && /^\d+$/.test(phase)) {
    redirect(courseHref(Number(phase), level && /^\d+$/.test(level) ? Number(level) : undefined));
  }

  let data: Awaited<ReturnType<typeof getPublicCourses>> | null = null;
  try {
    data = await getPublicCourses();
  } catch (error) {
    console.error("[Courses] Failed to load course data from Supabase:", error);
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <section className="bg-cream pb-12 pt-16 lg:pt-20">
          <div className="mx-auto max-w-6xl px-6 lg:px-10">
            <h1 className="program-rise max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-navy sm:text-5xl lg:text-6xl">
              Three phases. Start at the one that fits you.
            </h1>
            <p className="program-rise mt-5 max-w-2xl text-lg leading-relaxed text-navy/65 [animation-delay:120ms]">
              Seven months from your first French word to TEF/TCF exam day. Open a phase
              to watch its intro, read the full syllabus and pick a batch timing.
            </p>
          </div>
        </section>

        <LevelClimb />

        {data ? (
          <CoursesOverview phases={data.phases} programOffers={data.programOffers} />
        ) : (
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <p className="font-display text-lg font-semibold text-navy">
              Course information didn&apos;t load.
            </p>
            <p className="mt-2 text-sm text-navy/60">Refresh the page in a minute, or message us on WhatsApp.</p>
          </div>
        )}

        <section className="bg-navy py-16 text-white lg:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight">
                Want to see the full syllabus?
              </h2>
              <p className="mt-3 text-lg text-white/70">
                See exactly what each of the seven levels covers, month by month, from your
                first word to exam day.
              </p>
            </div>
            <Link
              href="/program#route"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-navy transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              See the full syllabus
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
