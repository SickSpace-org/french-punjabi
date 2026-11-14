import assert from "node:assert/strict";
import { test } from "node:test";
import { generateSlots } from "./slotTimes.ts";

test("splits a range into back-to-back 30-minute sessions", () => {
  const slots = generateSlots("12:00", "14:00");
  assert.deepEqual(
    slots?.map((s) => s.label),
    ["12:00 PM – 12:30 PM", "12:30 PM – 1:00 PM", "1:00 PM – 1:30 PM", "1:30 PM – 2:00 PM"],
  );
  assert.equal(slots?.[1].classTime, "12:30:00");
});

test("handles the AM/PM boundary and midnight-adjacent hours", () => {
  const slots = generateSlots("11:30", "12:30");
  assert.deepEqual(
    slots?.map((s) => s.label),
    ["11:30 AM – 12:00 PM", "12:00 PM – 12:30 PM"],
  );
  assert.equal(generateSlots("00:00", "00:30")?.[0].label, "12:00 AM – 12:30 AM");
});

test("drops a trailing remainder shorter than one session", () => {
  const slots = generateSlots("09:00", "10:20");
  assert.equal(slots?.length, 2);
});

test("rejects invalid or too-short ranges", () => {
  assert.equal(generateSlots("", "10:00"), null);
  assert.equal(generateSlots("25:00", "26:00"), null);
  assert.equal(generateSlots("10:00", "10:20"), null);
  assert.equal(generateSlots("14:00", "12:00"), null);
});
