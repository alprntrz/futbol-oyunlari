import assert from "node:assert/strict";
import { test } from "node:test";

import { dailyMatch, dailyMatchFor, dateOfDay, dayNumber } from "@/lib/daily";

// The archive (mobile/src/app/arsiv.tsx) opens past days by day number: these two helpers must agree
// with dailyMatch / dayNumber in every time zone CI or a laptop happens to run in.

test("dailyMatchFor(day) is the same pick as dailyMatch(date) for that day", () => {
  for (let i = 0; i < 60; i++) {
    const date = new Date(2026, 9, 1 + i);
    const a = dailyMatch(date);
    const b = dailyMatchFor(dayNumber(date));
    assert.equal(b.day, a.day);
    assert.equal(b.match.id, a.match.id);
  }
});

test("dateOfDay is the inverse of dayNumber", () => {
  for (let i = 0; i < 400; i++) {
    const date = new Date(2026, 0, 1 + i);
    assert.equal(dateOfDay(dayNumber(date)).getTime(), date.getTime());
  }
});
