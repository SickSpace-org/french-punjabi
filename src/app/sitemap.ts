import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/canonicalUrl";
import { getPublishedResources } from "@/lib/resources/queries";

export const revalidate = 3600;

/** Public, indexable routes that exist today. Student/teacher/admin areas are not listed. */
const STATIC_ROUTES = ["/", "/program", "/courses", "/results", "/contact", "/resources"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({ url: canonicalUrl(path) }));

  // Fails soft: if the table isn't set up yet, the sitemap simply has no resource pages.
  const result = await getPublishedResources();
  if (result.state === "ok") {
    for (const resource of result.resources) {
      entries.push({ url: canonicalUrl(`/resources/${resource.slug}`), lastModified: new Date(resource.updatedAt) });
    }
  }
  return entries;
}
