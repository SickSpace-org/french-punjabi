import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import SyllabusHero from "@/components/syllabus/SyllabusHero";
import CourseOverview from "@/components/syllabus/CourseOverview";
import CurriculumGoals from "@/components/syllabus/CurriculumGoals";
import SyllabusPhases from "@/components/syllabus/SyllabusPhases";
import RoadmapTimeline from "@/components/syllabus/RoadmapTimeline";
import AssessmentSection from "@/components/syllabus/AssessmentSection";
import CompletionOutcomes from "@/components/syllabus/CompletionOutcomes";
import SyllabusCta from "@/components/syllabus/SyllabusCta";

export const metadata: Metadata = {
  title: "Syllabus | AngrishFrançais",
  description:
    "The detailed 7-month French curriculum — what you'll learn across foundation, application, and exam-preparation phases.",
};

export default function SyllabusPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <SyllabusHero />
        <CourseOverview />
        <CurriculumGoals />
        <SyllabusPhases />
        <RoadmapTimeline />
        <AssessmentSection />
        <CompletionOutcomes />
        <SyllabusCta />
      </main>
      <Footer />
    </>
  );
}
