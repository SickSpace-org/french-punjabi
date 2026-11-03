import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/canonicalUrl";

/** Allow everything and point at the sitemap. Deliberately lists no paths. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
