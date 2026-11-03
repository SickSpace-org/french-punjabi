/**
 * The ONLY shape in which a resource leaves the server for a public page.
 * Pure (no imports) so a unit test can prove it never carries an object key.
 */

export type PublicResource = {
  slug: string;
  title: string;
  description: string;
  category: string;
  sizeBytes: number | null;
  updatedAt: string;
};

/** The columns the public pages select — deliberately excludes object_key and pending_object_key. */
export const PUBLIC_COLUMNS = "slug, title, description, category, size_bytes, updated_at, display_order";

export type PublicRow = {
  slug: string;
  title: string;
  description: string;
  category: string;
  size_bytes: number | null;
  updated_at: string;
  display_order: number;
};

/** Builds the projection field by field, so extra columns on `row` (e.g. a stray object_key) can never leak through. */
export function toPublic(row: PublicRow): PublicResource {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    sizeBytes: row.size_bytes,
    updatedAt: row.updated_at,
  };
}
