import assert from "node:assert/strict";
import { test } from "node:test";

import { SPOT_DIRS, SPOT_KICKS, SPOT_MAX_KICKS, spotHousePick, spotIsGoal, spotKicker, spotResult, spotTally, type SpotKick } from "@/lib/spot";

/** Kicks in order from a string: "1" scored, "0" not; X kicks first. */
const kicks = (s: string): SpotKick[] =>
  [...s].map((c, i) => ({ kicker: i % 2 === 0 ? "X" : "O", shot: "l", dive: c === "1" ? "r" : "l", goal: c === "1" }));

test("a kick scores unless the keeper picks the same side; no pick from the kicker is a miss", () => {
  assert.equal(spotIsGoal("l", "r"), true);
  assert.equal(spotIsGoal("c", "c"), false);
  assert.equal(spotIsGoal("r", null), true, "a keeper out of time stays put and is beaten");
  assert.equal(spotIsGoal(null, "l"), false);
  assert.equal(spotIsGoal(null, null), false);
});

test("X kicks first, then they swap", () => {
  assert.equal(spotKicker([]), "X");
  assert.equal(spotKicker(kicks("1")), "O");
  assert.equal(spotKicker(kicks("10")), "X");
});

test("goals are counted per kicker", () => {
  assert.deepEqual(spotTally(kicks("1011")), { X: 2, O: 1 });
});

test("the shootout stops as soon as the other side can't catch up", () => {
  // three each, 3-0: O's last two kicks can't reach 3
  assert.equal(spotResult(kicks("101010")), "X");
  assert.equal(spotResult(kicks("1010")), null, "2-0 with three O kicks left");
  assert.equal(spotResult(kicks("010101")), "O", "same the other way");
  assert.equal(spotResult(kicks("10101")), null, "3-0 with O still on three kicks");
});

test("level after five each goes to sudden death, decided on a full pair", () => {
  const level = "1".repeat(SPOT_KICKS * 2);
  assert.equal(spotResult(kicks(level)), null);
  assert.equal(spotResult(kicks(level + "1")), null, "O still answers");
  assert.equal(spotResult(kicks(level + "10")), "X");
  assert.equal(spotResult(kicks(level + "01")), "O");
  assert.equal(spotResult(kicks(level + "11")), null);
});

test("a shootout nobody can settle ends level", () => {
  assert.equal(spotResult(kicks("1".repeat(SPOT_MAX_KICKS * 2))), "draw");
});

test("the house player always names a side and leans to the rival's habit", () => {
  const habit: SpotKick[] = Array.from({ length: 8 }, (_, i) => ({ kicker: i % 2 === 0 ? "X" : "O", shot: i % 2 === 0 ? "r" : "l", dive: "c", goal: true }));
  let right = 0;
  for (let i = 0; i < 2000; i++) {
    const pick = spotHousePick(habit, "O");
    assert.ok(SPOT_DIRS.includes(pick));
    if (pick === "r") right++;
  }
  assert.ok(right > 900, `keeper O should lean to X's favourite corner, got ${right}/2000`);
  assert.ok(right < 1800, "but stay beatable");
});
