import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import CoursesHero from "@/components/courses/CoursesHero";
import CoursesBatches from "@/components/courses/CoursesBatches";
import CoursesCta from "@/components/courses/CoursesCta";

export const metadata: Metadata = {
  title: "Courses | French Punjabi",
  description:
    "Explore available French Punjabi batches and fees across Phase 1, 2, and 3 — choose a level, pick a timing, and enroll.",
};

export default function CoursesPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <CoursesHero />
        <CoursesBatches />
        <CoursesCta />
      </main>
      <Footer />
    </>
  );
}
