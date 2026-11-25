// Run under several machine time zones — the result must not change:
//   TZ=UTC node --test src/lib/attendance/schedule.test.mts
//   TZ=Asia/Kolkata node --test src/lib/attendance/schedule.test.mts
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mock } from "node:test";
import { isClassDayToday, nextClassDateAfterToday, scheduledDatesInWindow, dayLabel, torontoTodayStr } from "./schedule.ts";

const MON = 1, TUE = 2, WED = 3, FRI = 5;

function at(iso: string) {
  mock.timers.reset();
  mock.timers.enable({ apis: ["Date"], now: new Date(iso) });
}

afterEach(() => mock.timers.reset());

test("Monday 8:15 PM in Toronto is still Monday, though UTC is already Tuesday", () => {
  at("2026-11-24T01:15:00Z"); // Mon Nov 23, 8:15 PM EST
  const dates = scheduledDatesInWindow([MON, WED, FRI]);
  assert.equal(dates.at(-1), "2026-11-23");
  assert.ok(isClassDayToday([MON]));
  assert.ok(!isClassDayToday([TUE]));
});

test("window holds only real class weekdays, in date order, ending today", () => {
  at("2026-11-25T15:00:00Z"); // Wed Nov 25, 10 AM EST
  const dates = scheduledDatesInWindow([MON, WED, FRI], 28);
  assert.equal(dates.at(-1), "2026-11-25");
  assert.equal(dates[0], "2026-10-30"); // Fri, 27 days back
  for (const d of dates) assert.ok(["Mon", "Wed", "Fri"].includes(dayLabel(d)), d);
  assert.deepEqual([...dates].sort(), dates);
  assert.equal(dates.length, 12);
});

test("next class after today reads as the right day in Toronto", () => {
  at("2026-11-24T01:15:00Z"); // Mon evening Toronto
  const next = nextClassDateAfterToday([MON, WED]);
  assert.ok(next);
  assert.equal(
    next.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Toronto" }),
    "Wednesday, Nov 25"
  );
});

test("today's class is left out until check-in opens 30 min before class time", () => {
  at("2026-11-23T15:00:00Z"); // Mon 10:00 AM Toronto, 8 PM class
  assert.equal(scheduledDatesInWindow([MON], 8, "20:00:00").at(-1), "2026-11-16");
  at("2026-11-24T00:29:00Z"); // Mon 7:29 PM
  assert.equal(scheduledDatesInWindow([MON], 8, "20:00:00").at(-1), "2026-11-16");
  at("2026-11-24T00:30:00Z"); // Mon 7:30 PM — window open
  assert.equal(scheduledDatesInWindow([MON], 8, "20:00:00").at(-1), "2026-11-23");
  at("2026-11-23T15:00:00Z"); // no class time set → today counts all day
  assert.equal(scheduledDatesInWindow([MON], 8, null).at(-1), "2026-11-23");
});

test("torontoTodayStr is the Toronto date, not UTC", () => {
  at("2026-11-24T03:00:00Z"); // Mon 10 PM Toronto
  assert.equal(torontoTodayStr(), "2026-11-23");
});

test("dayLabel reads the calendar date, whatever the machine zone", () => {
  assert.equal(dayLabel("2026-11-23"), "Mon");
  assert.equal(dayLabel("2026-11-01"), "Sun");
});
