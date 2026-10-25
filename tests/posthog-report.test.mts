/** Morning PostHog report (scripts/lib/posthog-report.mjs): the Istanbul day window and the Markdown it writes. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { reportDay, renderReport } from "../scripts/lib/posthog-report.mjs";

test("the report covers yesterday in Istanbul time (UTC+3)", () => {
  // 08:00 in Istanbul on 25 Oct = 05:00 UTC
  const w = reportDay(new Date("2026-10-25T05:00:00Z"));
  assert.equal(w.day, "2026-10-24");
  assert.equal(w.from, "2026-10-23 21:00:00");
  assert.equal(w.to, "2026-10-24 21:00:00");
  assert.equal(w.weekFrom, "2026-10-17 21:00:00");
});

test("just after midnight in Istanbul the report is about the day that just ended", () => {
  // 00:30 in Istanbul on 25 Oct = 21:30 UTC on 24 Oct
  assert.equal(reportDay(new Date("2026-10-24T21:30:00Z")).day, "2026-10-24");
});

const empty = { daily: [], games: [], screens: [], events: [], versions: [], retention: [], newScreens: [] };

test("an empty day says so instead of printing empty tables", () => {
  const md = renderReport("2026-10-24", empty);
  assert.match(md, /2026-10-24/);
  assert.match(md, /Dün hiç kayıt yok/);
  assert.doesNotMatch(md, /\| Oyun/);
});

test("a day with data lists devices, games, screens and next-day returns", () => {
  const md = renderReport("2026-10-24", {
    ...empty,
    daily: [
      ["2026-10-23", 2, 1, 3, 4],
      ["2026-10-24", 5, 3, 7, 9],
    ],
    games: [
      ["ht", false, 6],
      ["kosu", true, 3],
    ],
    screens: [["/oyunlar", 4, 11]],
    events: [["push_permission", "true", 2]],
    versions: [["1.2.0", "26", "iOS", 5]],
    retention: [["2026-10-23", 1, 1]],
    newScreens: [["/onboarding", 3]],
  });
  assert.match(md, /\*\*5\*\* cihaz/);
  assert.match(md, /\*\*3\*\* yeni kurulum/);
  assert.match(md, /\| Tic-Tac-Toe \| 6 \| 0 \|/);
  assert.match(md, /\| Dribbling Rush \| 0 \| 3 \|/);
  assert.match(md, /\| \/oyunlar \| 4 \| 11 \|/);
  assert.match(md, /\| 2026-10-23 \| 1 \| 1 \| %100 \|/);
  assert.match(md, /Bildirim izni: verdi/);
  assert.match(md, /1\.2\.0 \(26\) iOS/);
});
