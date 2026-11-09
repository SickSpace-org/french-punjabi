import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import ResourceBrowser from "@/components/resources/ResourceBrowser";
import { getPublishedResources } from "@/lib/resources/queries";
import { canonicalUrl } from "@/lib/canonicalUrl";

// Rendered on demand, then cached for 5 minutes. Admin changes call revalidatePath, so edits show up immediately.
export const revalidate = 300;

const TITLE = "Free French Resources | AngrishFrançais";
const DESCRIPTION =
  "Free French practice assignments, worksheets and videos from AngrishFrançais — organised by topic.";

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonicalUrl("/resources") },
    openGraph: { title: TITLE, description: DESCRIPTION, url: canonicalUrl("/resources"), type: "website" },
  };
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-navy/60">{children}</p>
    </div>
  );
}

export default async function ResourcesPage() {
  const result = await getPublishedResources();

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-cream">
        <section className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
            Free French resources
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-navy/70">
            Practice assignments and worksheets you can read online, plus videos from our YouTube channel. Pick a topic and
            start.
          </p>

          {result.state === "unavailable" ? (
            <Notice>Our resources are being set up. Please check back soon.</Notice>
          ) : result.resources.length === 0 ? (
            <Notice>New resources are on their way. Please check back soon.</Notice>
          ) : (
            <ResourceBrowser resources={result.resources} />
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
