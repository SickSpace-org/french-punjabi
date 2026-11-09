// Unit tests for the YouTube-link parser and URL builders. Run with:  npm run test:resources
// Node's built-in test runner; no network, no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidVideoId, parseYouTubeUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "./youtube.ts";

const ID = "dQw4w9WgXcQ";

function accepted(input: string): string {
  const result = parseYouTubeUrl(input);
  assert.equal(result.ok, true, `should accept: ${JSON.stringify(input)}`);
  return result.ok ? result.videoId : "";
}

function rejected(input: unknown) {
  const result = parseYouTubeUrl(input);
  assert.equal(result.ok, false, `should reject: ${JSON.stringify(input)}`);
  assert.ok(!result.ok && result.error.length > 0);
}

// ---- accepted formats -----------------------------------------------------------------------

test("accepts every supported host and URL form", () => {
  const urls = [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://youtube.com/shorts/${ID}`,
    `https://m.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://m.youtube.com/live/${ID}`,
    `http://www.youtube.com/watch?v=${ID}`,
    `http://youtu.be/${ID}`,
  ];
  for (const url of urls) assert.equal(accepted(url), ID, url);
});

test("accepts a trailing slash on path forms", () => {
  assert.equal(accepted(`https://youtu.be/${ID}/`), ID);
  assert.equal(accepted(`https://www.youtube.com/shorts/${ID}/`), ID);
  assert.equal(accepted(`https://www.youtube.com/embed/${ID}/`), ID);
  assert.equal(accepted(`https://www.youtube.com/watch/?v=${ID}`), ID);
});

test("host matching is case-insensitive, and surrounding whitespace is trimmed", () => {
  assert.equal(accepted(`https://WWW.YOUTUBE.COM/watch?v=${ID}`), ID);
  assert.equal(accepted(`HTTPS://YouTu.BE/${ID}`), ID);
  assert.equal(accepted(`https://M.Youtube.com/shorts/${ID}`), ID);
  assert.equal(accepted(`  https://youtu.be/${ID}  `), ID);
  assert.equal(accepted(`\thttps://youtu.be/${ID}\n`), ID);
});

test("the video ID itself is case-sensitive and may contain - and _", () => {
  assert.equal(accepted("https://youtu.be/AbCdEfGhIjK"), "AbCdEfGhIjK");
  assert.equal(accepted("https://youtu.be/-_-_-_-_-_-"), "-_-_-_-_-_-");
  assert.equal(accepted("https://www.youtube.com/watch?v=a1B2c3D4e5_"), "a1B2c3D4e5_");
});

test("timestamps, tracking and other parameters are ignored (and never part of the result)", () => {
  const urls = [
    `https://youtu.be/${ID}?t=42`,
    `https://youtu.be/${ID}?t=1m2s`,
    `https://youtu.be/${ID}?si=AbCdEfGhIjKlMnOp&t=42`,
    `https://www.youtube.com/watch?v=${ID}&t=42s`,
    `https://www.youtube.com/watch?v=${ID}&feature=share&utm_source=x`,
    `https://www.youtube.com/watch?feature=share&v=${ID}`,
    `https://www.youtube.com/watch?v=${ID}#t=30`,
    `https://www.youtube.com/watch?v=${ID}&start=10&end=20`,
    `https://www.youtube.com/embed/${ID}?start=5&autoplay=1&rel=0`,
    `https://www.youtube.com/shorts/${ID}?feature=share`,
    `https://www.youtube.com/live/${ID}?si=xyz`,
    // a video that happens to be opened from inside a playlist is still just that one video
    `https://www.youtube.com/watch?v=${ID}&list=PLabcdefghijklmnop&index=2`,
  ];
  for (const url of urls) assert.equal(accepted(url), ID, url);
});

test("only the ID comes back — the result never contains the pasted URL", () => {
  const result = parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=42s&utm_source=evil`);
  assert.deepEqual(result, { ok: true, videoId: ID });
});

// ---- rejected input ---------------------------------------------------------------------------

test("rejects empty, whitespace-only and non-string input", () => {
  for (const input of ["", "   ", "\n\t", undefined, null, 42, {}, []]) rejected(input);
});

test("rejects lookalike hosts", () => {
  const hosts = [
    "youtube.com.evil.com",
    "www.youtube.com.evil.com",
    "evil.com/youtube.com",
    "notyoutube.com",
    "youtube.co",
    "youtube.com.",
    "www.youtube.com.",
    "youtu.be.evil.com",
    "evilyoutu.be",
    "yοutube.com", // Greek omicron
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "music.youtube.com",
    "studio.youtube.com",
    "gaming.youtube.com",
    "youtube.com:8080",
  ];
  for (const host of hosts) {
    rejected(`https://${host}/watch?v=${ID}`);
    rejected(`https://${host}/${ID}`);
  }
  rejected(`https://evil.com/?u=https://www.youtube.com/watch?v=${ID}`);
  rejected(`https://evil.com/watch?v=${ID}#www.youtube.com`);
  rejected(`https://evil.com#@www.youtube.com/watch?v=${ID}`);
});

test("rejects userinfo tricks", () => {
  rejected(`https://youtube.com@evil.com/watch?v=${ID}`);
  rejected(`https://www.youtube.com@evil.com/${ID}`);
  rejected(`https://youtu.be@evil.com/${ID}`);
  rejected(`https://user@www.youtube.com/watch?v=${ID}`);
  rejected(`https://user:pass@www.youtube.com/watch?v=${ID}`);
  rejected(`https://www.youtube.com:pass@youtu.be/${ID}`);
  rejected(`https://youtube.com\\@evil.com/watch?v=${ID}`);
});

test("rejects non-http(s) schemes", () => {
  rejected(`javascript:alert(1)`);
  rejected(`javascript://www.youtube.com/%0aalert(1)//watch?v=${ID}`);
  rejected(`JaVaScRiPt:alert(1)`);
  rejected(`data:text/html,<script>alert(1)</script>`);
  rejected(`data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==`);
  rejected(`ftp://www.youtube.com/watch?v=${ID}`);
  rejected(`file:///etc/passwd`);
  rejected(`vbscript:msgbox(1)`);
  rejected(`//www.youtube.com/watch?v=${ID}`);
  rejected(`www.youtube.com/watch?v=${ID}`);
  rejected(`youtu.be/${ID}`);
  rejected(ID);
});

test("rejects playlists, channels and other non-video pages", () => {
  rejected("https://www.youtube.com/playlist?list=PLabcdefghijklmnopqrstuvwxyz");
  rejected("https://www.youtube.com/watch?list=PLabcdefghijklmnopqrstuvwxyz"); // no v=
  rejected("https://www.youtube.com/embed/videoseries?list=PLabcdefghijklmnopqrstuvwxyz"); // "videoseries" is 11 chars
  rejected("https://www.youtube.com/embed/videoseries");
  rejected("https://www.youtube.com/@SomeChannel");
  rejected("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv");
  rejected("https://www.youtube.com/c/SomeChannel");
  rejected("https://www.youtube.com/user/someone");
  rejected("https://www.youtube.com/results?search_query=french");
  rejected("https://www.youtube.com/");
  rejected("https://www.youtube.com");
  rejected("https://youtu.be/");
  rejected("https://youtu.be");
  rejected(`https://www.youtube.com/${ID}`);
  rejected(`https://www.youtube.com/playlist/${ID}`);
  rejected(`https://www.youtube.com/v/${ID}`);
  rejected(`https://www.youtube.com/watch/${ID}`);
  rejected(`https://youtu.be/shorts/${ID}`);
  rejected(`https://youtu.be/${ID}/extra`);
  rejected(`https://www.youtube.com/shorts/${ID}/extra`);
  rejected(`https://www.youtube.com/embed/${ID}/extra`);
});

test("rejects missing, malformed or ambiguous video IDs", () => {
  for (const id of ["", "short", "dQw4w9WgXc", "dQw4w9WgXcQQ", "dQw4w9WgXc!", "dQw4w9Wg/cQ", "dQw4w9Wg.cQ", "dQw4w9 gXcQ", "dQw4w9WgXc%20"]) {
    rejected(`https://www.youtube.com/watch?v=${id}`);
    rejected(`https://youtu.be/${id}`);
  }
  rejected("https://www.youtube.com/watch");
  rejected("https://www.youtube.com/watch?v=");
  rejected(`https://www.youtube.com/watch?V=${ID}`);
  rejected(`https://www.youtube.com/watch?vv=${ID}`);
  rejected(`https://www.youtube.com/watch?v=${ID}&v=aaaaaaaaaaa`); // two different v values: ambiguous
  rejected(`https://www.youtube.com/watch?v=${ID}&v=${ID}`);
  rejected(`https://www.youtube.com/watch?v=${ID}%0A`);
  rejected(`https://www.youtube.com/watch?v=%24%7BID%7D`);
});

test("rejects whitespace or control characters inside the value, and absurd length", () => {
  rejected(`https://www.you tube.com/watch?v=${ID}`);
  rejected(`https://www.youtube.com/wa\ntch?v=${ID}`);
  rejected(`https://www.youtube.com/watch?v=${ID} https://evil.com`);
  rejected(`https://www.youtube.com/watch?v=${ID}\u0000`);
  rejected(`https://www.youtube.com/watch?v=${ID}&x=${"a".repeat(3000)}`);
  rejected("https://www.youtube.com/watch?v=dQw4w9WgXcQ​".replace("​", "\u0085"));
});

test("an error message is returned for every rejection, and empty input asks for a link", () => {
  const empty = parseYouTubeUrl("  ");
  assert.equal(empty.ok === false && empty.error, "Paste a YouTube link.");
  const bad = parseYouTubeUrl("https://evil.com");
  assert.equal(bad.ok, false);
});

// ---- video IDs and URL builders -------------------------------------------------------------

test("isValidVideoId accepts exactly 11 URL-safe characters and not 'videoseries'", () => {
  assert.equal(isValidVideoId(ID), true);
  assert.equal(isValidVideoId("-_-_-_-_-_-"), true);
  for (const bad of ["videoseries", "", "short", "dQw4w9WgXcQ ", " dQw4w9WgXcQ", "dQw4w9WgXc/", null, undefined, 12345678901, {}]) {
    assert.equal(isValidVideoId(bad), false, String(bad));
  }
});

test("watch and thumbnail URLs are built from the ID alone", () => {
  assert.equal(youtubeWatchUrl(ID), `https://www.youtube.com/watch?v=${ID}`);
  assert.equal(youtubeThumbnailUrl(ID), `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
});

test("the URL builders refuse anything that is not a valid ID (no injection into the built URLs)", () => {
  for (const bad of ["", "videoseries", `${ID}&autoplay=1`, `${ID}/../x`, "javascript:alert(1)", "https://evil.com", `${ID}\n`]) {
    assert.throws(() => youtubeWatchUrl(bad), /Invalid YouTube video ID/, bad);
    assert.throws(() => youtubeThumbnailUrl(bad), /Invalid YouTube video ID/, bad);
  }
});

test("a parsed ID always builds URLs on the expected hosts only", () => {
  const inputs = [`https://youtu.be/${ID}?t=5`, `https://m.youtube.com/shorts/${ID}`, `https://www.youtube.com/live/${ID}`];
  for (const input of inputs) {
    const parsed = parseYouTubeUrl(input);
    assert.ok(parsed.ok);
    if (!parsed.ok) continue;
    assert.equal(new URL(youtubeWatchUrl(parsed.videoId)).origin, "https://www.youtube.com");
    assert.equal(new URL(youtubeThumbnailUrl(parsed.videoId)).origin, "https://i.ytimg.com");
  }
});
