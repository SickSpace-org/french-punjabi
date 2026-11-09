"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Search } from "lucide-react";
import type { PublicResource } from "@/lib/resources/projection";
import { formatBytes } from "@/lib/resources/config";
import VideoBadge from "./VideoBadge";
import VideoThumbnail from "./VideoThumbnail";
import WatchOnYouTube from "./WatchOnYouTube";

/** Lower-case and strip accents, so "present" finds "Présent". */
function normalize(text: string) {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matches(resource: PublicResource, terms: string[]) {
  if (terms.length === 0) return true;
  const haystack = normalize(`${resource.title} ${resource.description} ${resource.category}`);
  return terms.every((term) => haystack.includes(term));
}

function groupByCategory(resources: PublicResource[]) {
  const groups = new Map<string, PublicResource[]>();
  for (const r of resources) {
    const key = r.category || "More resources";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()];
}

function PdfCard({ r }: { r: PublicResource }) {
  return (
    <Link
      href={`/resources/${r.slug}`}
      className="group flex h-full gap-4 rounded-2xl border border-navy/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red/30 hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-soft text-red">
        <FileText className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-base font-semibold text-navy group-hover:text-red">{r.title}</span>
        {r.description ? <span className="mt-1 line-clamp-3 block text-sm text-navy/65">{r.description}</span> : null}
        {r.sizeBytes ? <span className="mt-2 block text-xs text-navy/40">PDF · {formatBytes(r.sizeBytes)}</span> : null}
      </span>
    </Link>
  );
}

function VideoCard({ r }: { r: PublicResource }) {
  if (!r.video) return null;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm transition-all hover:border-red/30 hover:shadow-md">
      <Link href={`/resources/${r.slug}`} className="group block">
        <VideoThumbnail src={r.video.thumbnailUrl} />
        <span className="block px-5 pt-4">
          <VideoBadge />
          <span className="mt-2 block font-display text-base font-semibold text-navy group-hover:text-red">{r.title}</span>
        </span>
      </Link>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-1">
        {r.description ? <p className="line-clamp-3 text-sm text-navy/65">{r.description}</p> : null}
        <div className="mt-auto pt-4">
          <WatchOnYouTube href={r.video.watchUrl} title={r.title} />
        </div>
      </div>
    </div>
  );
}

/** One column: a heading with a count, then the cards grouped by category. */
function Column({
  id,
  heading,
  items,
  total,
  emptyText,
  children,
}: {
  id: string;
  heading: string;
  items: PublicResource[];
  total: number;
  emptyText: string;
  children: (r: PublicResource) => React.ReactNode;
}) {
  const groups = groupByCategory(items);
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2
        id={id}
        className="flex items-baseline gap-2 border-b border-navy/10 pb-3 font-display text-2xl font-semibold text-navy"
      >
        {heading}
        <span className="text-sm font-medium text-navy/40">
          {items.length === total ? total : `${items.length} of ${total}`}
        </span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-navy/15 bg-white px-5 py-8 text-center text-sm text-navy/55">
          {emptyText}
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map(([category, group], index) => (
            <div key={category} role="group" aria-labelledby={`${id}-cat-${index}`}>
              <h3 id={`${id}-cat-${index}`} className="text-xs font-semibold uppercase tracking-wider text-navy/50">
                {category}
              </h3>
              <ul className="mt-3 space-y-4">
                {group.map((r) => (
                  <li key={r.slug}>{children(r)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The public /resources listing: PDFs in one column and videos in another (stacked on phones), so the two kinds never
 * mix, with one search box that filters both. A kind that has no resources at all gets no column.
 */
export default function ResourceBrowser({ resources }: { resources: PublicResource[] }) {
  const [query, setQuery] = useState("");

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const allPdfs = resources.filter((r) => r.type === "pdf");
  const allVideos = resources.filter((r) => r.type === "youtube");
  const pdfs = allPdfs.filter((r) => matches(r, terms));
  const videos = allVideos.filter((r) => matches(r, terms));
  const showBoth = allPdfs.length > 0 && allVideos.length > 0;
  const nothingFound = terms.length > 0 && pdfs.length === 0 && videos.length === 0;

  return (
    <div>
      <div className="relative mt-8 max-w-xl">
        <label htmlFor="resource-search" className="sr-only">
          Search resources
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" aria-hidden="true" />
        <input
          id="resource-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, topic or keyword"
          autoComplete="off"
          className="w-full rounded-full border border-navy/15 bg-white py-3 pl-11 pr-4 text-sm text-navy outline-none placeholder:text-navy/40 focus:border-red focus:ring-4 focus:ring-red/10"
        />
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {terms.length > 0 ? `${pdfs.length + videos.length} matching resources` : ""}
      </p>

      {nothingFound ? (
        <p className="mt-10 rounded-2xl border border-dashed border-navy/15 bg-white px-6 py-12 text-center text-sm font-medium text-navy/60">
          No resources match &ldquo;{query.trim()}&rdquo;. Try a different word.
        </p>
      ) : (
        <div className={`mt-10 grid items-start gap-12 ${showBoth ? "lg:grid-cols-2 lg:gap-10" : ""}`}>
          {allPdfs.length > 0 ? (
            <Column
              id="pdf-column"
              heading="PDF worksheets"
              items={pdfs}
              total={allPdfs.length}
              emptyText="No PDFs match your search."
            >
              {(r) => <PdfCard r={r} />}
            </Column>
          ) : null}
          {allVideos.length > 0 ? (
            <Column
              id="video-column"
              heading="Videos"
              items={videos}
              total={allVideos.length}
              emptyText="No videos match your search."
            >
              {(r) => <VideoCard r={r} />}
            </Column>
          ) : null}
        </div>
      )}
    </div>
  );
}
