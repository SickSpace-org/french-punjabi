"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/**
 * A 16:9 video thumbnail. Plain <img> (no image optimizer, so no next.config remotePatterns), lazy-loaded, from the
 * server-built i.ytimg.com address. If the image can't load (deleted/private video, blocked host, offline) it falls back to a
 * dark play-icon placeholder instead of a broken-image icon. Decorative: whatever wraps it carries the accessible name.
 */
export default function VideoThumbnail({ src, className = "" }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`relative block aspect-video w-full overflow-hidden bg-navy ${className}`}>
      {failed ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // An image that failed before React hydrated never fires onError, so also check on mount.
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0) setFailed(true);
          }}
          src={src}
          alt=""
          width={480}
          height={360}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          // hqdefault is 4:3 with black bars top and bottom; object-cover in a 16:9 box crops exactly the bars away.
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy/70 text-white shadow-lg ring-1 ring-white/30">
          <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2} />
        </span>
      </span>
    </span>
  );
}
