import "server-only";
import { NextResponse } from "next/server";

/** JSON that must never be cached by the browser, a CDN or the framework. */
export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export const unavailableJson = () =>
  noStoreJson({ error: "This file is temporarily unavailable. Please try again shortly." }, 503);
export const notFoundJson = () => noStoreJson({ error: "Not found." }, 404);
export const forbiddenJson = () => noStoreJson({ error: "Not authorized." }, 403);
export const badRequestJson = (message: string) => noStoreJson({ error: message }, 400);
