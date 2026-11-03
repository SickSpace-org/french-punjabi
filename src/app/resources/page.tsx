import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import { getPublishedResources, type PublicResource } from "@/lib/resources/queries";
import { canonicalUrl } from "@/lib/canonicalUrl";
import { formatBytes } from "@/lib/resources/config";

// Rendered on demand, then cached for 5 minutes. Admin changes call revalidatePath, so edits show up immediately.
export const revalidate = 300;

const TITLE = "Free French Resources | AngrishFrançais";
const DESCRIPTION =
  "Free French practice assignments and worksheets from AngrishFrançais — read them online, organised by topic.";

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: canonicalUrl("/resources") },
    openGraph: { title: TITLE, description: DESCRIPTION, url: canonicalUrl("/resources"), type: "website" },
  };
}

function groupByCategory(resources: PublicResource[]) {
  const groups = new Map<string, PublicResource[]>();
  for (const r of resources) {
    const key = r.category || "More resources";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()];
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
  const groups = result.state === "ok" ? groupByCategory(result.resources) : [];

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-cream">
        <section className="mx-auto max-w-4xl px-6 py-16 lg:px-10 lg:py-20">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
            Free French resources
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-navy/70">
            Practice assignments and worksheets you can read online, right here. Pick a topic and start.
          </p>

          {result.state === "unavailable" ? (
            <Notice>Our resources are being set up. Please check back soon.</Notice>
          ) : groups.length === 0 ? (
            <Notice>New resources are on their way. Please check back soon.</Notice>
          ) : (
            <div className="mt-12 space-y-12">
              {groups.map(([category, items]) => (
                <section key={category} aria-labelledby={`cat-${category}`}>
                  <h2 id={`cat-${category}`} className="font-display text-xl font-semibold text-navy">
                    {category}
                  </h2>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {items.map((r) => (
                      <li key={r.slug}>
                        <Link
                          href={`/resources/${r.slug}`}
                          className="group flex h-full gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red/30 hover:shadow-md"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red">
                            <FileText className="h-5 w-5" strokeWidth={2} />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-display text-base font-semibold text-navy group-hover:text-red">
                              {r.title}
                            </span>
                            {r.description ? (
                              <span className="mt-1 line-clamp-3 block text-sm text-navy/65">{r.description}</span>
                            ) : null}
                            {r.sizeBytes ? (
                              <span className="mt-2 block text-xs text-navy/40">PDF · {formatBytes(r.sizeBytes)}</span>
                            ) : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
