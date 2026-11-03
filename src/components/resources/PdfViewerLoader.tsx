"use client";

import dynamic from "next/dynamic";

/** PDF.js touches `window`/canvas, so the viewer is loaded on the client only (and its bundle only when a resource page opens). */
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60dvh] min-h-[320px] items-center justify-center rounded-2xl border border-navy/10 bg-white text-sm text-navy/60">
      Loading document…
    </div>
  ),
});

export default function PdfViewerLoader({ endpoint, title }: { endpoint: string; title: string }) {
  return <PdfViewer endpoint={endpoint} title={title} />;
}
