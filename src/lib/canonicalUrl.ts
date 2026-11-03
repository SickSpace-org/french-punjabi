/**
 * The ONE canonical origin for absolute URLs that search engines see:
 * canonical tags, Open Graph URLs, the sitemap and robots.txt.
 *
 * The site serves from https://www.angrishfrancais.com, so on Vercel
 * Production NEXT_PUBLIC_SITE_URL must be exactly that (scheme + www host, no
 * trailing slash, no path). Without that, canonical URLs would point at the
 * wrong host (the apex, a *.vercel.app URL or localhost) and split ranking.
 *
 * Behaviour:
 *  - development (`next dev`): a missing/invalid value THROWS, so a
 *    misconfiguration is noticed immediately instead of shipping silently.
 *  - production (including `next build`): a missing/invalid value logs an
 *    error and falls back to the canonical www origin, so the public site can
 *    never go down over a metadata problem.
 *
 * Not related to getSiteUrl() in ./siteUrl.ts (Stripe redirects; unchanged).
 */

export const CANONICAL_ORIGIN = "https://www.angrishfrancais.com";

/** Pure so it can be unit-tested: returns the origin to use, or null if `raw` is unusable. */
export function parseCanonicalOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getCanonicalOrigin(): string {
  const parsed = parseCanonicalOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (parsed) return parsed;

  const problem =
    "NEXT_PUBLIC_SITE_URL is missing or not a valid URL. Set it to https://www.angrishfrancais.com " +
    "(it is used for canonical tags, Open Graph URLs, the sitemap and robots.txt).";
  if (process.env.NODE_ENV === "development") throw new Error(problem);
  console.error(`[canonicalUrl] ${problem} Falling back to ${CANONICAL_ORIGIN}.`);
  return CANONICAL_ORIGIN;
}

export function canonicalUrl(path: string): string {
  return `${getCanonicalOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
