import { ExternalLink } from "lucide-react";

/**
 * The only way a visitor leaves for YouTube. `href` must be the server-built watch URL from the public projection
 * (https://www.youtube.com/watch?v=<id>) — never a pasted value.
 */
export default function WatchOnYouTube({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-red px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-red/30 transition-colors hover:bg-red-dark"
    >
      Watch on YouTube
      <ExternalLink className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
      <span className="sr-only">
        : {title} (opens in a new tab)
      </span>
    </a>
  );
}
