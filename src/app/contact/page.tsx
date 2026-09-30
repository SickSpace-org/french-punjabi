import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import ContactHero from "@/components/contact/ContactHero";
import ContactMethods from "@/components/contact/ContactMethods";

export const metadata: Metadata = {
  title: "Contact | AngrishFrançais",
  description: "Reach AngrishFrançais on WhatsApp, Instagram, or email.",
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        <ContactHero />
        <ContactMethods />
      </main>
      <Footer />
    </>
  );
}
