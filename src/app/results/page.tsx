import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import ResultsHero from "@/components/results/ResultsHero";
import StudentResultsGrid from "@/components/results/StudentResultsGrid";
import ReviewsWall from "@/components/results/ReviewsWall";
import ResultsPath from "@/components/results/ResultsPath";

export const metadata: Metadata = {
  title: "Results | AngrishFrançais",
  description:
    "Official TEF and TCF Canada results and reviews from students who prepared with AngrishFrançais.",
};

export default function ResultsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <ResultsHero />
        <StudentResultsGrid />
        <ReviewsWall />
        <ResultsPath />
      </main>
      <Footer />
    </>
  );
}
