// Unit tests for the public Resources feature's pure logic (upload cap, slugs, finalize verification, fail-soft error
// mapping, canonical origin, public projection). Run with:  npm run test:resources
// Node's built-in test runner; no network, no database, no R2, no real files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_MAX_UPLOAD_MB,
  MAX_UPLOAD_MB_CEILING,
  OBJECT_KEY_PATTERN,
  SLUG_PATTERN,
  getMaxUploadBytes,
  parseMaxUploadMb,
  slugify,
} from "./config.ts";
import { isMissingColumnError, isMissingTableError } from "./errors.ts";
import { toPublic, LEGACY_PUBLIC_COLUMNS, PUBLIC_COLUMNS } from "./projection.ts";
import { verifyUploadedPdf, type VerifyStorage } from "./verifyUpload.ts";
import { CANONICAL_ORIGIN, getCanonicalOrigin, parseCanonicalOrigin } from "../canonicalUrl.ts";

const MB = 1024 * 1024;

// ---- upload cap -----------------------------------------------------------------------------

test("upload cap defaults to 8 MB and is adjustable", () => {
  assert.equal(DEFAULT_MAX_UPLOAD_MB, 8);
  assert.equal(parseMaxUploadMb(undefined), 8);
  assert.equal(parseMaxUploadMb(""), 8);
  assert.equal(parseMaxUploadMb("   "), 8);
  assert.equal(parseMaxUploadMb("12"), 12);
  assert.equal(parseMaxUploadMb("2.5"), 2.5);
});

test("a bad cap value falls back to the default; a huge one is clamped to the ceiling", () => {
  for (const bad of ["abc", "-3", "0", "NaN", "Infinity"]) assert.equal(parseMaxUploadMb(bad), 8, bad);
  assert.equal(parseMaxUploadMb("5000"), MAX_UPLOAD_MB_CEILING);
});

test("getMaxUploadBytes reads RESOURCES_MAX_UPLOAD_MB", () => {
  const saved = process.env.RESOURCES_MAX_UPLOAD_MB;
  try {
    delete process.env.RESOURCES_MAX_UPLOAD_MB;
    assert.equal(getMaxUploadBytes(), 8 * MB);
    process.env.RESOURCES_MAX_UPLOAD_MB = "20";
    assert.equal(getMaxUploadBytes(), 20 * MB);
  } finally {
    if (saved === undefined) delete process.env.RESOURCES_MAX_UPLOAD_MB;
    else process.env.RESOURCES_MAX_UPLOAD_MB = saved;
  }
});

// ---- slugs and object names ---------------------------------------------------------------

test("slugify makes safe lower-case ASCII slugs", () => {
  assert.equal(slugify("Présent de l'indicatif — Exercises"), "present-de-l-indicatif-exercises");
  assert.equal(slugify("  TEF / TCF Practice #1  "), "tef-tcf-practice-1");
  assert.equal(slugify("!!!"), "resource");
  assert.equal(slugify("日本語"), "resource");
  const long = slugify("word ".repeat(60));
  assert.ok(long.length <= 70 && !long.endsWith("-"));
  for (const title of ["Hello World", "Été 2025", "a", "x".repeat(300)]) {
    assert.match(slugify(title), SLUG_PATTERN, title);
  }
});

test("object keys must be a lower-case uuid + .pdf (no paths, no traversal)", () => {
  assert.match(`${randomUUID()}.pdf`, OBJECT_KEY_PATTERN);
  for (const bad of ["../x.pdf", "a/b.pdf", `${randomUUID()}.PDF`, `${randomUUID()}.pdf/`, randomUUID(), `${randomUUID().toUpperCase()}.pdf`, ""]) {
    assert.doesNotMatch(bad, OBJECT_KEY_PATTERN, bad);
  }
});

// ---- finalize verification ----------------------------------------------------------------

function fakeStorage(object: { bytes: Uint8Array; size?: number } | null): VerifyStorage & { reads: number } {
  const s = {
    reads: 0,
    async head() {
      return object ? { size: object.size ?? object.bytes.length } : null;
    },
    async readFirstBytes(_key: string, count: number) {
      s.reads += 1;
      return object ? object.bytes.slice(0, count) : new Uint8Array();
    },
  };
  return s;
}
const bytes = (text: string) => new TextEncoder().encode(text);

test("finalize accepts a real-looking PDF within the cap", async () => {
  const body = bytes("%PDF-1.7\n...rest of file...");
  const result = await verifyUploadedPdf(fakeStorage({ bytes: body }), "k.pdf", 8 * MB);
  assert.deepEqual(result, { ok: true, size: body.length });
});

test("finalize rejects a missing object", async () => {
  const result = await verifyUploadedPdf(fakeStorage(null), "k.pdf", 8 * MB);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "missing");
});

test("finalize rejects an empty object", async () => {
  const result = await verifyUploadedPdf(fakeStorage({ bytes: new Uint8Array(), size: 0 }), "k.pdf", 8 * MB);
  assert.equal(result.ok === false && result.reason, "empty");
});

test("finalize rejects an object over the cap without reading its contents", async () => {
  const storage = fakeStorage({ bytes: bytes("%PDF-1.7"), size: 8 * MB + 1 });
  const result = await verifyUploadedPdf(storage, "k.pdf", 8 * MB);
  assert.equal(result.ok === false && result.reason, "too_large");
  assert.equal(storage.reads, 0);
});

test("finalize accepts an object exactly at the cap", async () => {
  const result = await verifyUploadedPdf(fakeStorage({ bytes: bytes("%PDF-1.4"), size: 8 * MB }), "k.pdf", 8 * MB);
  assert.equal(result.ok, true);
});

test("finalize rejects non-PDF content, however it is named", async () => {
  for (const text of ["<!doctype html><html>", "PK\u0003\u0004zip", "%PDX-1.4", "%PD", "   %PDF-1.4"]) {
    const result = await verifyUploadedPdf(fakeStorage({ bytes: bytes(text) }), "k.pdf", 8 * MB);
    assert.equal(result.ok === false && result.reason, "not_pdf", JSON.stringify(text));
  }
});

// ---- fail-soft error mapping ----------------------------------------------------------------

test("a missing table is recognised in every form Supabase reports it", () => {
  assert.equal(isMissingTableError({ code: "42P01" }), true);
  assert.equal(isMissingTableError({ code: "PGRST205", message: "Could not find the table 'public.resources' in the schema cache" }), true);
  assert.equal(isMissingTableError({ message: 'relation "public.resources" does not exist' }), true);
  assert.equal(isMissingTableError({ code: "23505", message: "duplicate key" }), false);
  assert.equal(isMissingTableError({ code: "42501", message: "permission denied for table resources" }), false);
  assert.equal(isMissingTableError(null), false);
  assert.equal(isMissingTableError(undefined), false);
});

test("a missing 064 column is recognised, and is not mistaken for a missing table", () => {
  const select = { code: "42703", message: "column resources.resource_type does not exist" };
  const insert = { code: "PGRST204", message: "Could not find the 'resource_type' column of 'resources' in the schema cache" };
  for (const error of [select, insert]) {
    assert.equal(isMissingColumnError(error), true, error.code);
    // The PostgREST column message also says "schema cache", which used to read as a missing table.
    assert.equal(isMissingTableError(error), false, error.code);
  }
  assert.equal(isMissingColumnError({ code: "42P01", message: 'relation "public.resources" does not exist' }), false);
  assert.equal(isMissingColumnError({ code: "PGRST205", message: "Could not find the table 'public.resources' in the schema cache" }), false);
  assert.equal(isMissingColumnError({ code: "23505", message: "duplicate key" }), false);
  assert.equal(isMissingColumnError(null), false);
  assert.equal(isMissingColumnError(undefined), false);
});

// ---- public projection: no storage keys, ever ---------------------------------------------

const PROJECTION_KEYS = ["category", "description", "sizeBytes", "slug", "title", "type", "updatedAt", "video"];

function leakyRow(extra: Record<string, unknown> = {}) {
  return {
    slug: "present",
    title: "Présent",
    description: "Practise the present tense.",
    category: "Grammar",
    size_bytes: 123456,
    updated_at: "2026-11-03T00:00:00Z",
    display_order: 10,
    // Extra columns that must NOT survive the projection:
    object_key: `${randomUUID()}.pdf`,
    pending_object_key: `${randomUUID()}.pdf`,
    original_name: "secret-name.pdf",
    id: randomUUID(),
    ...extra,
  };
}

test("the public projection never carries a storage key, even if the row has one", () => {
  // A row from before migration 064 has no resource_type: it is a PDF.
  const projected = toPublic(leakyRow());
  assert.ok(projected);
  const json = JSON.stringify(projected);
  assert.doesNotMatch(json, /object_key|pending|\.pdf|secret-name|[0-9a-f]{8}-[0-9a-f]{4}-/i);
  assert.deepEqual(Object.keys(projected).sort(), PROJECTION_KEYS);
  assert.equal(projected.type, "pdf");
  assert.equal(projected.video, null);
  assert.equal(projected.sizeBytes, 123456);
});

test("a PDF row with the 064 columns present projects the same way", () => {
  const projected = toPublic(leakyRow({ resource_type: "pdf", youtube_video_id: null }));
  assert.ok(projected);
  assert.equal(projected.type, "pdf");
  assert.equal(projected.video, null);
  assert.deepEqual(Object.keys(projected).sort(), PROJECTION_KEYS);
});

test("a video projection carries only server-built URLs — no file keys, no raw video-id column, no pasted link", () => {
  // Even a (constraint-violating) video row that somehow had file keys must not leak them.
  const projected = toPublic(
    leakyRow({ resource_type: "youtube", youtube_video_id: "dQw4w9WgXcQ", size_bytes: null, pasted_url: "https://evil.com/?x=1" })
  );
  assert.ok(projected);
  assert.equal(projected.type, "youtube");
  assert.deepEqual(Object.keys(projected).sort(), PROJECTION_KEYS);
  assert.deepEqual(projected.video, {
    watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  });
  assert.equal(projected.sizeBytes, null);
  const json = JSON.stringify(projected);
  assert.doesNotMatch(json, /object_key|pending|\.pdf|secret-name|evil\.com|pasted|youtube_video_id|[0-9a-f]{8}-[0-9a-f]{4}-/i);
});

test("a video row with a missing or invalid stored ID is dropped rather than rendered", () => {
  for (const bad of [null, undefined, "", "short", "videoseries", "dQw4w9WgXcQ&x=1", "javascript:alert(1)"]) {
    assert.equal(toPublic(leakyRow({ resource_type: "youtube", youtube_video_id: bad })), null, String(bad));
  }
});

test("the public SELECT lists exclude both key columns", () => {
  assert.doesNotMatch(PUBLIC_COLUMNS, /object_key|pending_object_key|original_name|\*/);
  assert.doesNotMatch(LEGACY_PUBLIC_COLUMNS, /object_key|pending_object_key|original_name|\*/);
  // The legacy list is what runs before migration 064, so it must not mention the new columns.
  assert.doesNotMatch(LEGACY_PUBLIC_COLUMNS, /resource_type|youtube_video_id/);
  assert.match(PUBLIC_COLUMNS, /resource_type/);
  assert.match(PUBLIC_COLUMNS, /youtube_video_id/);
});

// ---- canonical origin ---------------------------------------------------------------------

test("canonical origin parsing keeps only scheme + host", () => {
  assert.equal(parseCanonicalOrigin("https://www.angrishfrancais.com"), "https://www.angrishfrancais.com");
  assert.equal(parseCanonicalOrigin("https://www.angrishfrancais.com/"), "https://www.angrishfrancais.com");
  assert.equal(parseCanonicalOrigin("  https://www.angrishfrancais.com/some/path?x=1  "), "https://www.angrishfrancais.com");
  assert.equal(parseCanonicalOrigin("http://localhost:3000"), "http://localhost:3000");
  for (const bad of [undefined, "", "   ", "not a url", "www.angrishfrancais.com", "ftp://x.com", "javascript:alert(1)"]) {
    assert.equal(parseCanonicalOrigin(bad), null, String(bad));
  }
});

test("a missing NEXT_PUBLIC_SITE_URL throws in development and falls back to the www host in production", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { url: env.NEXT_PUBLIC_SITE_URL, node: env.NODE_ENV };
  const originalError = console.error;
  try {
    delete env.NEXT_PUBLIC_SITE_URL;

    env.NODE_ENV = "development";
    assert.throws(() => getCanonicalOrigin(), /NEXT_PUBLIC_SITE_URL/);

    env.NODE_ENV = "production";
    console.error = () => {};
    assert.equal(getCanonicalOrigin(), CANONICAL_ORIGIN);
    assert.equal(CANONICAL_ORIGIN, "https://www.angrishfrancais.com");

    env.NEXT_PUBLIC_SITE_URL = "https://www.angrishfrancais.com";
    assert.equal(getCanonicalOrigin(), "https://www.angrishfrancais.com");
  } finally {
    console.error = originalError;
    if (saved.url === undefined) delete env.NEXT_PUBLIC_SITE_URL;
    else env.NEXT_PUBLIC_SITE_URL = saved.url;
    if (saved.node === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = saved.node;
  }
});
