/**
 * The daily puzzles must stay the same for everyone: a data or rule change that reshuffles future
 * days (CLAUDE.md: "adding or removing matches reshuffles future days") fails here. If it's on
 * purpose, print the new values with the snippet in the failure message and update them.
 */
// dayNumber reads the phone's local date: pin the zone most players are in, so CI (UTC) and a
// laptop in Istanbul compute the same days
process.env.TZ = "Europe/Istanbul";

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { dailyMatch } from "@/lib/daily";
import { dailyRand, dealQuestions, themeForDay } from "@/lib/duel";
import { generateGrid, seededRandom } from "@/lib/tiki";

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const DAYS = Array.from({ length: 400 }, (_, i) => 20000 + i);

test("daily Tic-Tac-Toe grids are unchanged", () => {
  const all = DAYS.map((day) => {
    const g = generateGrid(seededRandom(day * 7919 + 17));
    return `${g.rows.map((c) => c.id)}|${g.cols.map((c) => c.id)}`;
  });
  assert.equal(hash(all.join("\n") + "\n"), "824ccf69ea99f67a", "daily grids changed: every player's grid for those days moves");
});

test("daily Missing 11 matches are unchanged", () => {
  const all = DAYS.map((day) => dailyMatch(new Date(day * 86_400_000 + 12 * 3_600_000)).match.id);
  assert.equal(hash(all.join("\n") + "\n"), "43be966b5834d50b", "daily matches changed (matches added/removed reshuffle future days)");
});

test("daily Card Duel themes and questions are unchanged", () => {
  const all = DAYS.map((day) => `${themeForDay(day).id}:${dealQuestions(dailyRand(day)).map((q) => q.stat + (q.lower ? "-" : ""))}`);
  assert.equal(hash(all.join("\n") + "\n"), "9dac2994cf9f1b6b");
});
