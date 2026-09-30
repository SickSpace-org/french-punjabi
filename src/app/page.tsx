import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import AudienceAndResults from "@/components/home/AudienceAndResults";
import JourneyPreview from "@/components/home/JourneyPreview";
import FounderIntro from "@/components/home/FounderIntro";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import ReviewsMarquee from "@/components/results/ReviewsMarquee";
import HomeFaq from "@/components/home/HomeFaq";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <Hero />
        <AudienceAndResults />
        <JourneyPreview />
        <FounderIntro />
        <WhyChooseUs />
        <ReviewsMarquee />
        <HomeFaq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
