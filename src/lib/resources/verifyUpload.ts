/**
 * The finalize step's check, kept free of any SDK import so it can be unit
 * tested with a fake storage. It does no heavy file work: one HEAD (size) and
 * one ranged read of the first 5 bytes.
 */

export type VerifyStorage = {
  head(key: string): Promise<{ size: number } | null>;
  readFirstBytes(key: string, count: number): Promise<Uint8Array>;
};

export type VerifyResult =
  | { ok: true; size: number }
  | { ok: false; reason: "missing" | "empty" | "too_large" | "not_pdf"; message: string };

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export async function verifyUploadedPdf(
  storage: VerifyStorage,
  key: string,
  maxBytes: number
): Promise<VerifyResult> {
  const head = await storage.head(key);
  if (!head) {
    return { ok: false, reason: "missing", message: "The upload was not found. Please upload the file again." };
  }
  if (head.size <= 0) {
    return { ok: false, reason: "empty", message: "The uploaded file is empty." };
  }
  if (head.size > maxBytes) {
    return {
      ok: false,
      reason: "too_large",
      message: `The uploaded file is larger than the ${(maxBytes / (1024 * 1024)).toFixed(0)} MB limit.`,
    };
  }

  const start = await storage.readFirstBytes(key, PDF_MAGIC.length);
  const isPdf = start.length >= PDF_MAGIC.length && PDF_MAGIC.every((byte, i) => start[i] === byte);
  if (!isPdf) {
    return { ok: false, reason: "not_pdf", message: "That file is not a PDF." };
  }

  return { ok: true, size: head.size };
}
