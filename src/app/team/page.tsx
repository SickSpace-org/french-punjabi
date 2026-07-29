import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import TeamHero from "@/components/team/TeamHero";
import TeamGrid from "@/components/team/TeamGrid";

export const metadata: Metadata = {
  title: "Team | French Punjabi",
  description: "Meet the trainers and coordinators behind French Punjabi.",
};

export default function TeamPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <TeamHero />
        <TeamGrid />
      </main>
      <Footer />
    </>
  );
}
