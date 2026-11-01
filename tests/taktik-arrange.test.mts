/** Pitch Chess "best line-up" (autoArrange in src/lib/taktik/engine.ts): players go where they are strongest. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { autoArrange, newLobby } from "@/lib/taktik/engine";
import { SLOTS, type Pos, type Star } from "@/lib/taktik/rules";
import type { Unit } from "@/lib/taktik/types";

function squad(spec: [Pos, Star][], level: number) {
  const l = newLobby(1, [{ name: "me", coach: "pass" }], []);
  const m = l.managers[0];
  m.level = level;
  m.units = spec.map(([pos, star], i): Unit => {
    const p = l.players.find((x) => x.pos === pos)!;
    return { ...p, pid: p.pid, uid: `u${i}`, star, items: [], slot: null };
  });
  autoArrange(m);
  return m.units;
}
const zoneOf = (u: Unit) => (u.slot === null ? null : SLOTS[u.slot]);

test("a star striker is not put in the back line while real defenders are free", () => {
  const units = squad(
    [
      ["GK", 1],
      ["FWD", 3],
      ["FWD", 3],
      ["FWD", 3],
      ["FWD", 3],
      ["DEF", 1],
      ["DEF", 1],
      ["MID", 1],
    ],
    8
  );
  for (const u of units.filter((x) => x.pos === "FWD")) assert.notEqual(zoneOf(u), "DEF", `${u.uid} plays in defence`);
  assert.equal(units.filter((u) => u.pos === "DEF" && zoneOf(u) === "DEF").length, 2);
});

test("the pitch is still filled and there is a back line when only forwards are left", () => {
  const units = squad(
    [
      ["GK", 1],
      ["FWD", 1],
      ["FWD", 1],
      ["FWD", 1],
      ["FWD", 1],
      ["FWD", 1],
    ],
    6
  );
  assert.equal(units.filter((u) => u.slot !== null).length, 6);
  assert.ok(units.some((u) => zoneOf(u) === "DEF"));
});
