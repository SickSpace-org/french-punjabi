import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import CoursesHero from "@/components/courses/CoursesHero";
import CoursesBatches from "@/components/courses/CoursesBatches";
import CoursesCta from "@/components/courses/CoursesCta";
import { getPublicCourses } from "@/lib/courses/getPublicCourses";

export const metadata: Metadata = {
  title: "Courses | French Punjabi",
  description:
    "Explore available French Punjabi batches and fees across Phase 1, 2, and 3 — choose a level, pick a timing, and enroll.",
};

// Course data is admin-managed and can change at any time — always read
// fresh from the database rather than serving a stale cached render.
export const revalidate = 0;

export default async function CoursesPage() {
  let phases: Awaited<ReturnType<typeof getPublicCourses>>["phases"] = [];
  let programOffers: Awaited<ReturnType<typeof getPublicCourses>>["programOffers"] = {};
  let loadFailed = false;

  try {
    const data = await getPublicCourses();
    phases = data.phases;
    programOffers = data.programOffers;
  } catch (error) {
    console.error("[Courses] Failed to load course data from Supabase:", error);
    loadFailed = true;
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <CoursesHero />
        {loadFailed ? (
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <p className="font-display text-lg font-semibold text-navy">
              Course information is temporarily unavailable.
            </p>
            <p className="mt-2 text-sm text-navy/60">Please try again shortly.</p>
          </div>
        ) : (
          <CoursesBatches phases={phases} programOffers={programOffers} />
        )}
        <CoursesCta />
      </main>
      <Footer />
    </>
  );
}
