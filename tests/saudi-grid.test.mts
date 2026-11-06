import assert from "node:assert/strict";
import { test } from "node:test";

import { GRID_PLAYERS, cellSolvable } from "@/lib/tiki";
import { dailySeed, dealRoomGrid, emptyCells, gridFromIds, gridToIds, localDay, placePlayer, roomCodeOf, saudiGrid, scoreOf, squareCriteria } from "@/lib/saudiGrid";
import { statsBody, utmOf, type WebContext } from "@/lib/webStats";

test("a year of daily Saudi grids: solvable, three Saudi clubs at least, no World Cup square", () => {
  for (let day = 20000; day < 20365; day++) {
    const grid = saudiGrid(dailySeed(day));
    const lines = [...grid.rows, ...grid.cols];
    assert.ok(lines.filter((c) => c.id.startsWith("arab-") && c.kind === "club").length >= 3, `day ${day}`);
    assert.ok(lines.every((c) => !c.en.includes("World Cup")), `day ${day}`);
    for (let i = 0; i < 9; i++) assert.ok(cellSolvable(...squareCriteria(grid, i)), `day ${day} square ${i}`);
  }
});

test("the same day gives the same grid", () => {
  const ids = (seed: number) => { const g = saudiGrid(seed); return [...g.rows, ...g.cols].map((c) => c.id); };
  assert.deepEqual(ids(dailySeed(20400)), ids(dailySeed(20400)));
});

test("the day turns over at local midnight", () => {
  assert.equal(localDay(new Date(2026, 10, 6, 23, 59)) + 1, localDay(new Date(2026, 10, 7, 0, 1)));
});

test("a player fills every square they fit, once", () => {
  const grid = saudiGrid(dailySeed(20400));
  const [row, col] = squareCriteria(grid, 0);
  const player = GRID_PLAYERS.find((p) => row.test(p) && col.test(p))!;
  const first = placePlayer(emptyCells(), grid, player);
  assert.ok(first.added >= 1);
  assert.equal(first.added, first.fits);
  assert.ok(first.cells[0].includes(player.name));
  const again = placePlayer(first.cells, grid, player);
  assert.equal(again.added, 0);
  assert.deepEqual(scoreOf(again.cells), scoreOf(first.cells));
});

test("a player who fits nowhere changes nothing", () => {
  const grid = saudiGrid(dailySeed(20400));
  const nobody = { name: "Nobody", country: "nowhere", clubs: [] };
  const cells = emptyCells();
  const result = placePlayer(cells, grid, nobody);
  assert.equal(result.fits, 0);
  assert.deepEqual(result.cells, cells);
});

test("a room grid survives the trip as ids", () => {
  const ids = dealRoomGrid(() => 0.5);
  assert.deepEqual(gridToIds(gridFromIds(ids)!), ids);
  assert.equal(gridFromIds({ rows: ["nope"], cols: [] }), null);
});

test("an invite link gives a room code only in the server's alphabet", () => {
  assert.equal(roomCodeOf("?room=ab2cd"), "AB2CD");
  assert.equal(roomCodeOf("?room=AB1CD"), null);
  assert.equal(roomCodeOf("?room=<x>"), null);
  assert.equal(roomCodeOf(""), null);
});

test("stats keep only plain campaign tags", () => {
  assert.deepEqual(utmOf("?utm_source=snap&utm_campaign=a b&gclid=x&utm_content=v1.2"), { utm_source: "snap", utm_content: "v1.2" });
});

test("a stats event has no person, no location and no extra field", () => {
  const ctx: WebContext = { locale: "ar", search: "?utm_source=tiktok&name=ali", timeZone: "Asia/Riyadh", device: "android", daysSinceFirst: 1 };
  const { properties } = statsBody("key", "game_finish", { boxes: 7, players: 9, ended: "time" }, ctx, "id");
  assert.equal(properties.$process_person_profile, false);
  assert.equal(properties.$geoip_disable, true);
  assert.deepEqual(Object.keys(properties).sort(), ["$geoip_disable", "$process_person_profile", "boxes", "days_since_first", "device", "ended", "locale", "players", "time_zone", "utm_source"]);
});
