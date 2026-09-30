import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import ContactHero from "@/components/contact/ContactHero";
import ContactMethods from "@/components/contact/ContactMethods";
import HomeFaq from "@/components/home/HomeFaq";

export const metadata: Metadata = {
  title: "Contact | AngrishFrançais",
  description:
    "Reach AngrishFrançais on WhatsApp, Instagram or email, or book a consultation call to find your level and the right batch.",
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <ContactHero />
        <ContactMethods />
        <HomeFaq />
      </main>
      <Footer />
    </>
  );
}
