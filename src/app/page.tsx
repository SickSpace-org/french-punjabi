import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import FounderIntro from "@/components/home/FounderIntro";
import FounderCertificate from "@/components/home/FounderCertificate";
import AudienceAndResults from "@/components/home/AudienceAndResults";
import WhyChooseUs from "@/components/home/WhyChooseUs";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <Hero />
        <FounderIntro />
        <FounderCertificate />
        <AudienceAndResults />
        <WhyChooseUs />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
