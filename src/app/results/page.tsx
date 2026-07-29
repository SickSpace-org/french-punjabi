import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import ResultsHero from "@/components/results/ResultsHero";
import ReviewsMarquee from "@/components/results/ReviewsMarquee";
import StudentResultsGrid from "@/components/results/StudentResultsGrid";

export const metadata: Metadata = {
  title: "Results | French Punjabi",
  description: "Student reviews and results from French Punjabi.",
};

export default function ResultsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <ResultsHero />
        <ReviewsMarquee />
        <StudentResultsGrid />
      </main>
      <Footer />
    </>
  );
}
