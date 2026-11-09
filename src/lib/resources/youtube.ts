/**
 * YouTube link handling for the Resources feature. Pure (no imports) so it is unit-testable and safe in any bundle.
 *
 * The admin pastes a URL; the SERVER parses it down to an 11-character video ID and throws the pasted text away. Only the ID is
 * stored. Every URL the site ever shows or links to (watch link, thumbnail) is built here from that ID — the pasted URL is never
 * echoed, stored or linked.
 *
 * Accepted: http(s) URLs on youtube.com / www.youtube.com / m.youtube.com in the forms
 *   /watch?v=<id>   /shorts/<id>   /embed/<id>   /live/<id>
 * and youtu.be/<id>. Everything else is rejected: other hosts (including lookalikes such as youtube.com.evil.com and userinfo
 * tricks such as https://youtube.com@evil.com), non-http(s) schemes (javascript:, data:, …), playlists, channels and empty input.
 * Other query parameters and fragments (start times, tracking, ?list=…) are ignored.
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const MAX_INPUT_LENGTH = 2048;

/**
 * "videoseries" is exactly 11 characters from the ID alphabet but is the path used by playlist embeds
 * (/embed/videoseries?list=…), so it must never be treated as a video ID.
 */
const RESERVED_NON_IDS = new Set(["videoseries"]);

export type ParsedYouTubeUrl = { ok: true; videoId: string } | { ok: false; error: string };

export function isValidVideoId(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ID_PATTERN.test(value) && !RESERVED_NON_IDS.has(value);
}

const INVALID: ParsedYouTubeUrl = {
  ok: false,
  error: "That doesn't look like a YouTube video link. Paste a link to a single video (youtube.com or youtu.be).",
};

export function parseYouTubeUrl(input: unknown): ParsedYouTubeUrl {
  if (typeof input !== "string") return INVALID;
  const raw = input.trim();
  if (raw === "") return { ok: false, error: "Paste a YouTube link." };
  if (raw.length > MAX_INPUT_LENGTH) return INVALID;
  // Whitespace or control characters inside the value: the URL parser would silently strip some of them, so refuse instead.
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(raw)) return INVALID;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return INVALID;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return INVALID;
  // https://youtube.com@evil.com parses with hostname "evil.com" and username "youtube.com": never accept userinfo.
  if (url.username !== "" || url.password !== "") return INVALID;
  // A default port (:443 / :80) is normalised away, so any remaining port is unusual.
  if (url.port !== "") return INVALID;

  // WHATWG URL lower-cases the host, so YOUTUBE.COM and Youtube.com are accepted; an exact-match allow-list rejects
  // youtube.com.evil.com, notyoutube.com, a trailing-dot host, punycode lookalikes and so on.
  const host = url.hostname;
  let candidate: string | undefined;

  if (host === "youtu.be") {
    candidate = /^\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (/^\/watch\/?$/.test(url.pathname)) {
      const values = url.searchParams.getAll("v");
      if (values.length === 1) candidate = values[0];
    } else {
      candidate = /^\/(?:shorts|embed|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1];
    }
  }

  if (!isValidVideoId(candidate)) return INVALID;
  return { ok: true, videoId: candidate };
}

function assertValidId(videoId: string): string {
  if (!isValidVideoId(videoId)) throw new Error("Invalid YouTube video ID");
  return videoId;
}

/** The link visitors are sent to. Always built from the stored ID. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${assertValidId(videoId)}`;
}

/** Thumbnail image (480×360, the 16:9 picture is letter-boxed inside it; crop with object-cover). */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${assertValidId(videoId)}/hqdefault.jpg`;
}
