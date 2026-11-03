"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Read-only PDF viewer: no toolbar, no download/print button, no text or
 * annotation layer — pages are painted onto canvases with PDF.js.
 *
 * Honest scope: this is a reading experience, NOT content protection. The
 * browser has to receive the PDF bytes to draw them, so anyone using the
 * network tab can still get the file (see the plan / README note).
 *
 * How it loads: POST `endpoint` → { url } (a ~120 s signed URL), fetch the
 * whole file once with `cache: "no-store"`, then render pages lazily from
 * memory. Because the file is fetched once, the short URL lifetime is enough
 * and no range requests (which would need a longer-lived URL) are used.
 *
 * Memory: only pages near the viewport hold a canvas; the rest are released.
 * Zoom (1×–3×) is a live CSS width change during a pinch/wheel/key gesture and
 * a crisp re-render ~150 ms after the gesture settles. Canvas pixel area is
 * capped (iOS Safari limits canvas memory).
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const PAGE_GAP = 12;
const SIDE_PAD = 8;
const MAX_CANVAS_PIXELS = 12_000_000;
const RENDER_SETTLE_MS = 150;

type Phase =
  | { kind: "loading"; percent: number | null }
  | { kind: "ready" }
  | { kind: "error"; message: string };

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

async function fetchPdfBytes(
  endpoint: string,
  onProgress: (percent: number | null) => void,
  signal: AbortSignal
): Promise<Uint8Array> {
  const signed = await fetch(endpoint, { method: "POST", cache: "no-store", signal });
  if (!signed.ok) throw new Error(`signing ${signed.status}`);
  const { url } = (await signed.json()) as { url?: string };
  if (!url) throw new Error("no url");

  const res = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal });
  if (!res.ok || !res.body) throw new Error(`file ${res.status}`);

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(total > 0 ? Math.min(99, Math.round((received / total) * 100)) : null);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function PageSlot({
  doc,
  pageNumber,
  total,
  ratio,
  liveWidth,
  renderWidth,
  root,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  total: number;
  ratio: number;
  liveWidth: number;
  renderWidth: number;
  root: HTMLDivElement | null;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  // "Near" = within 1.5 viewport heights: render it; outside that: release its canvas.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !root) return;
    const observer = new IntersectionObserver((entries) => setNear(entries[entries.length - 1].isIntersecting), {
      root,
      rootMargin: "150% 0px",
    });
    observer.observe(slot);
    return () => observer.disconnect();
  }, [root]);

  const release = useCallback(() => {
    const holder = holderRef.current;
    if (!holder) return;
    holder.querySelectorAll("canvas").forEach((c) => {
      c.width = 0;
      c.height = 0;
    });
    holder.replaceChildren();
  }, []);

  useEffect(() => {
    if (!near) release();
  }, [near, release]);

  useEffect(() => release, [release]);

  // Render (or re-render at a new zoom). The new canvas is painted off-DOM and
  // swapped in when finished, so a re-render after zooming never flashes blank.
  useEffect(() => {
    if (!near || renderWidth <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    const canvas = document.createElement("canvas");

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const cssScale = renderWidth / base.width;
      let outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const cssPixels = renderWidth * renderWidth * ratio;
      if (cssPixels * outputScale * outputScale > MAX_CANVAS_PIXELS) {
        outputScale = Math.sqrt(MAX_CANVAS_PIXELS / cssPixels);
      }
      const viewport = page.getViewport({ scale: cssScale * outputScale });
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      canvas.style.cssText = "display:block;width:100%;height:100%";
      canvas.setAttribute("draggable", "false");

      task = page.render({ canvas, viewport });
      await task.promise;
      page.cleanup();
      if (cancelled) return;

      holderRef.current?.querySelectorAll("canvas").forEach((old) => {
        old.width = 0;
        old.height = 0;
      });
      holderRef.current?.replaceChildren(canvas);
    })().catch((error: unknown) => {
      if ((error as { name?: string })?.name !== "RenderingCancelledException" && !cancelled) {
        console.error("[PdfViewer] page render failed", pageNumber, error);
      }
    });

    return () => {
      cancelled = true;
      task?.cancel();
      if (!canvas.isConnected) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
  }, [near, doc, pageNumber, renderWidth, ratio]);

  return (
    <div
      ref={slotRef}
      role="img"
      aria-label={`Page ${pageNumber} of ${total}`}
      className="mx-auto bg-white shadow-sm ring-1 ring-navy/10"
      style={{ width: liveWidth, height: liveWidth * ratio, marginBottom: PAGE_GAP }}
    >
      <div ref={holderRef} className="h-full w-full" />
    </div>
  );
}

export default function PdfViewer({ endpoint, title }: { endpoint: string; title: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading", percent: null });
  const [attempt, setAttempt] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratios, setRatios] = useState<number[]>([]);
  const [fitWidth, setFitWidth] = useState(0);
  const [liveZoom, setLiveZoom] = useState(1);
  const [renderZoom, setRenderZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const settleTimer = useRef<number | null>(null);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const liveZoomRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ startDist: number; startZoom: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  const setScrollNode = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setScrollEl(node);
  }, []);

  // ---- load the file and the document -------------------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    let loadingTask: ReturnType<typeof import("pdfjs-dist/legacy/build/pdf.mjs").getDocument> | null = null;
    let cancelled = false;

    (async () => {
      setPhase({ kind: "loading", percent: null });
      setDoc(null);
      const bytes = await fetchPdfBytes(
        endpoint,
        (percent) => !cancelled && setPhase({ kind: "loading", percent }),
        controller.signal
      );

      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      loadingTask = pdfjs.getDocument({ data: bytes });
      const loadedDoc = await loadingTask.promise;
      if (cancelled) return;

      const sizes: number[] = [];
      for (let i = 1; i <= loadedDoc.numPages; i++) {
        const page = await loadedDoc.getPage(i);
        const v = page.getViewport({ scale: 1 });
        sizes.push(v.height / v.width);
        page.cleanup();
        if (cancelled) return;
      }
      setRatios(sizes);
      setDoc(loadedDoc);
      setPhase({ kind: "ready" });
    })().catch((error: unknown) => {
      if (cancelled || (error as { name?: string })?.name === "AbortError") return;
      console.error("[PdfViewer] load failed", error);
      setPhase({
        kind: "error",
        message: "This document is temporarily unavailable. Please try again in a moment.",
      });
    });

    return () => {
      cancelled = true;
      controller.abort();
      void loadingTask?.destroy();
    };
  }, [endpoint, attempt]);

  // ---- measure the available width ----------------------------------------------------
  useEffect(() => {
    if (!scrollEl) return;
    const measure = () => setFitWidth(Math.max(0, scrollEl.clientWidth - SIDE_PAD * 2));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scrollEl);
    return () => observer.disconnect();
  }, [scrollEl, phase.kind]);

  // ---- zoom -------------------------------------------------------------------------
  const applyZoom = useCallback(
    (requested: number, focal?: { x: number; y: number }) => {
      const el = scrollRef.current;
      const next = clampZoom(requested);
      const prev = liveZoomRef.current;
      if (!el || next === prev) return;

      const ratio = next / prev;
      const fx = focal?.x ?? el.clientWidth / 2;
      const fy = focal?.y ?? el.clientHeight / 2;
      pendingScroll.current = {
        left: (el.scrollLeft + fx - SIDE_PAD) * ratio + SIDE_PAD - fx,
        top: (el.scrollTop + fy) * ratio - fy,
      };
      liveZoomRef.current = next;
      setLiveZoom(next);

      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setRenderZoom(next), RENDER_SETTLE_MS);
    },
    []
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const target = pendingScroll.current;
    if (!el || !target) return;
    el.scrollLeft = target.left;
    el.scrollTop = target.top;
    pendingScroll.current = null;
  }, [liveZoom]);

  useEffect(
    () => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    },
    []
  );

  // Ctrl/⌘ + wheel (and trackpad pinch) must be a non-passive listener to cancel the browser's page zoom.
  useEffect(() => {
    const el = scrollEl;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyZoom(liveZoomRef.current * Math.exp(-e.deltaY * 0.01), { x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scrollEl, applyZoom]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "+" || e.key === "=") applyZoom(liveZoomRef.current * 1.25);
    else if (e.key === "-" || e.key === "_") applyZoom(liveZoomRef.current / 1.25);
    else if (e.key === "0") applyZoom(1);
    else return;
    e.preventDefault();
  };

  const localPoint = (e: React.PointerEvent) => {
    const rect = scrollRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, startZoom: liveZoomRef.current };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = scrollRef.current?.getBoundingClientRect();
      applyZoom(pinch.current.startZoom * (dist / pinch.current.startDist), {
        x: (a.x + b.x) / 2 - (rect?.left ?? 0),
        y: (a.y + b.y) / 2 - (rect?.top ?? 0),
      });
    }
  };

  const endPointer = (e: React.PointerEvent, isCancel: boolean) => {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    // Double tap / double click: toggle between fit-width and 2×.
    if (wasSingle && !isCancel) {
      const now = performance.now();
      const last = lastTap.current;
      if (last && now - last.time < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
        lastTap.current = null;
        applyZoom(liveZoomRef.current > 1.05 ? 1 : 2, localPoint(e));
      } else {
        lastTap.current = { time: now, x: e.clientX, y: e.clientY };
      }
    }
  };

  // ---- current page indicator ---------------------------------------------------------
  const liveWidth = fitWidth * liveZoom;
  const renderWidth = fitWidth * renderZoom;

  const pageOffsets = useMemo(() => {
    const offsets: number[] = [];
    let y = PAGE_GAP;
    for (const r of ratios) {
      offsets.push(y);
      y += liveWidth * r + PAGE_GAP;
    }
    return offsets;
  }, [ratios, liveWidth]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || pageOffsets.length === 0) return;
    const probe = el.scrollTop + el.clientHeight / 3;
    let lo = 0;
    let hi = pageOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (pageOffsets[mid] <= probe) lo = mid;
      else hi = mid - 1;
    }
    setCurrentPage(lo + 1);
  }, [pageOffsets]);

  // ---- render -------------------------------------------------------------------------
  if (phase.kind === "error") {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white px-6 py-14 text-center">
        <p className="text-sm font-medium text-navy/70">{phase.message}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-4 inline-flex rounded-full bg-red px-5 py-2 text-sm font-semibold text-white hover:bg-red-dark"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-root relative w-full">
      {/* Printing the page prints nothing of the document. A deterrent only. */}
      <style>{`@media print { .pdf-viewer-root { display: none !important; } }`}</style>

      {phase.kind === "loading" || !doc ? (
        <div
          role="status"
          className="flex h-[60dvh] min-h-[320px] flex-col items-center justify-center rounded-2xl border border-navy/10 bg-white"
        >
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-navy/10">
            <div
              className="h-full rounded-full bg-red transition-all"
              style={{ width: phase.kind === "loading" && phase.percent !== null ? `${phase.percent}%` : "35%" }}
            />
          </div>
          <p className="mt-3 text-sm text-navy/60">
            Loading document{phase.kind === "loading" && phase.percent !== null ? ` · ${phase.percent}%` : "…"}
          </p>
        </div>
      ) : (
        <>
          <div
            ref={setScrollNode}
            tabIndex={0}
            role="document"
            aria-label={`${title} — document viewer. Use plus and minus to zoom.`}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endPointer(e, false)}
            onPointerCancel={(e) => endPointer(e, true)}
            onContextMenu={(e) => e.preventDefault()}
            onScroll={onScroll}
            className="h-[78dvh] min-h-[420px] overflow-auto overscroll-contain rounded-2xl border border-navy/10 bg-cream-dim outline-none focus-visible:ring-4 focus-visible:ring-red/20"
            style={{
              touchAction: "pan-x pan-y",
              overflowAnchor: "none",
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
          >
            <div style={{ width: liveWidth + SIDE_PAD * 2, paddingTop: PAGE_GAP, paddingInline: SIDE_PAD }}>
              {ratios.map((ratio, i) => (
                <PageSlot
                  key={i}
                  doc={doc}
                  pageNumber={i + 1}
                  total={ratios.length}
                  ratio={ratio}
                  liveWidth={liveWidth}
                  renderWidth={renderWidth}
                  root={scrollEl}
                />
              ))}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-navy/80 px-3 py-1 text-xs font-semibold tabular-nums text-white"
          >
            {currentPage} / {ratios.length}
          </div>
        </>
      )}
    </div>
  );
}
