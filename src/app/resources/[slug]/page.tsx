import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import PdfViewerLoader from "@/components/resources/PdfViewerLoader";
import VideoBadge from "@/components/resources/VideoBadge";
import VideoThumbnail from "@/components/resources/VideoThumbnail";
import WatchOnYouTube from "@/components/resources/WatchOnYouTube";
import { getPublishedResource } from "@/lib/resources/queries";
import { canonicalUrl } from "@/lib/canonicalUrl";
import { SLUG_PATTERN } from "@/lib/resources/config";

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

function summarize(description: string, fallback: string) {
  const text = description.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG_PATTERN.test(slug)) return { title: "Resources | AngrishFrançais", robots: { index: false } };

  const result = await getPublishedResource(slug);
  if (result.state !== "ok") return { title: "Resources | AngrishFrançais", robots: { index: false } };

  const { resource } = result;
  const title = `${resource.title} | AngrishFrançais`;
  const description = summarize(resource.description, `${resource.title} — a free French resource from AngrishFrançais.`);
  const url = canonicalUrl(`/resources/${resource.slug}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      ...(resource.video ? { images: [{ url: resource.video.thumbnailUrl, width: 480, height: 360 }] } : {}),
    },
  };
}

export default async function ResourcePage({ params }: PageProps) {
  const { slug } = await params;
  if (!SLUG_PATTERN.test(slug)) notFound();

  const result = await getPublishedResource(slug);
  // "unavailable" (table not set up, database hiccup) is also a plain 404 here: there is nothing to show yet.
  if (result.state !== "ok") notFound();
  const { resource } = result;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: resource.title,
    description: summarize(resource.description, resource.title),
    url: canonicalUrl(`/resources/${resource.slug}`),
    inLanguage: "fr",
    isAccessibleForFree: true,
    learningResourceType: resource.category || (resource.video ? "Video" : "Worksheet"),
    provider: { "@type": "Organization", name: "AngrishFrançais", url: canonicalUrl("/") },
    dateModified: resource.updatedAt,
    ...(resource.video ? { thumbnailUrl: resource.video.thumbnailUrl } : {}),
  };

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-cream">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          <Link
            href="/resources"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy/60 hover:text-red"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            All resources
          </Link>

          <header className="mt-5">
            {resource.category ? (
              <p className="text-xs font-semibold uppercase tracking-wider text-red">{resource.category}</p>
            ) : null}
            {resource.video ? (
              <div className="mt-2">
                <VideoBadge />
              </div>
            ) : null}
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              {resource.title}
            </h1>
            {resource.description ? (
              <div className="mt-4 max-w-3xl space-y-3 text-base leading-relaxed text-navy/75">
                {resource.description.split(/\n{2,}/).map((paragraph, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
          </header>

          {resource.video ? (
            // No embedded player: the thumbnail and the button both go to YouTube, in a new tab.
            <div className="mt-8 max-w-3xl">
              <a
                href={resource.video.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Watch ${resource.title} on YouTube (opens in a new tab)`}
                className="block overflow-hidden rounded-2xl border border-navy/10 shadow-sm transition-shadow hover:shadow-md"
              >
                <VideoThumbnail src={resource.video.thumbnailUrl} />
              </a>
              <div className="mt-5">
                <WatchOnYouTube href={resource.video.watchUrl} title={resource.title} />
              </div>
              <p className="mt-3 text-xs text-navy/40">Opens on YouTube in a new tab.</p>
            </div>
          ) : (
            <>
              <div className="mt-8">
                <PdfViewerLoader endpoint={`/api/resources/${resource.slug}/file`} title={resource.title} />
              </div>
              <p className="mt-3 text-center text-xs text-navy/40">Scroll to read · pinch or double-tap to zoom</p>
            </>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}
