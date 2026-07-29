import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import StructureHero from "@/components/structure/StructureHero";
import ProgramJourney from "@/components/structure/ProgramJourney";
import JourneyTimeline from "@/components/structure/JourneyTimeline";
import SkillsGrid from "@/components/structure/SkillsGrid";
import StructureCta from "@/components/structure/StructureCta";

export const metadata: Metadata = {
  title: "Program Structure | French Punjabi",
  description:
    "A visual look at the 7-month French Punjabi program — 3 phases, progressive levels, and how students build toward TEF/TCF exam readiness.",
};

export default function StructurePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <StructureHero />
        <ProgramJourney />
        <JourneyTimeline />
        <SkillsGrid />
        <StructureCta />
      </main>
      <Footer />
    </>
  );
}
