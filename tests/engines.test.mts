/** The simulation engines: Pitch Chess (taktik) and Dribbling Rush (kosu). Deterministic and they finish. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { LANE, newRun, step, type Input } from "@/lib/kosu/engine";
import { RUSH_NAMES } from "@/lib/kosu/names";
import { botTurn } from "@/lib/taktik/bot";
import { endRound, newLobby } from "@/lib/taktik/engine";
import type { Personality } from "@/lib/taktik/types";

const KINDS: Personality[] = ["loyal", "econ", "roller", "opportunist"];

function playLobby(seed: number) {
  const l = newLobby(seed, [], Array.from({ length: 8 }, (_, i) => ({ name: `bot${i}`, personality: KINDS[i % 4] })));
  let rounds = 0;
  while (!l.over && rounds < 80) {
    endRound(l, botTurn);
    rounds++;
  }
  return { l, rounds };
}

test("Pitch Chess: an all-bot lobby ends in a sensible number of rounds", () => {
  for (const seed of [1, 2, 3]) {
    const { l, rounds } = playLobby(1000 + seed * 7919);
    assert.ok(l.over, `lobby ${seed} never ended`);
    assert.ok(rounds >= 8 && rounds <= 60, `lobby ${seed}: ${rounds} rounds`);
  }
});

test("Pitch Chess: the same seed plays the same game", () => {
  const a = playLobby(4242);
  const b = playLobby(4242);
  assert.equal(a.rounds, b.rounds);
  assert.deepEqual(
    a.l.managers.map((m) => m.place ?? m.hp),
    b.l.managers.map((m) => m.place ?? m.hp)
  );
});

function run(seed: number, policy: (t: number) => Input, extras = false) {
  const s = newRun(seed, [], extras);
  let t = 0;
  while (!s.dead && t < 60 * 60 * 5) {
    step(s, policy(t), 1 / 60);
    t++;
  }
  return { s, t };
}

test("Dribbling Rush: standing still, the runner is caught sooner or later", () => {
  const { s } = run(7, () => "");
  assert.ok(s.dead, "a run with no input never ended");
  assert.ok(s.z > 0);
});

test("Dribbling Rush: same seed and inputs, same run", () => {
  const policy = (t: number): Input => (t % 90 === 0 ? (["left", "right", "up", "down"] as const)[(t / 90) % 4] : "");
  const a = run(99, policy);
  const b = run(99, policy);
  assert.equal(a.t, b.t);
  assert.equal(Math.round(a.s.z), Math.round(b.s.z));
  assert.equal(a.s.coinsTaken, b.s.coinsTaken);
});

test("Dribbling Rush (3D rules): blocks come up, and the same seed plays the same run", () => {
  const policy = (t: number): Input => (t % 70 === 0 ? (["left", "up", "right", "down", "right", "left"] as const)[(t / 70) % 6] : "");
  const a = run(4242, policy, true);
  const b = run(4242, policy, true);
  assert.ok(a.s.dead, "a 3D run never ended");
  assert.equal(a.t, b.t);
  assert.equal(a.s.coinsTaken, b.s.coinsTaken);
  // walk far enough with nothing in the way (no collisions checked here) to see the layout has blocks
  const s = newRun(77, [], true);
  let blocks = 0;
  for (let i = 0; i < 60 * 40; i++) {
    s.ghost = 1;
    step(s, "", 1 / 60);
    blocks = Math.max(blocks, s.blocks.length);
  }
  assert.ok(blocks > 0, "no blocks in 40 s");
});

test("Dribbling Rush (3D rules): letters spell the name, and a finished name raises the multiplier", () => {
  assert.ok(RUSH_NAMES.every((n) => /^[A-Z]{4,9}$/.test(n)), "names must be 4–9 letters A–Z");
  const s = newRun(5, [], true, ["MESSI", "KAKA"]);
  // walk through everything, always in the lane of the next letter
  for (let i = 0; i < 60 * 90 && s.wordsDone < 1; i++) {
    s.ghost = 1;
    const next = s.letters.find((l) => !l.taken && l.z > s.z);
    if (next) {
      s.lane = next.lane;
      s.x = next.lane * LANE;
    }
    step(s, "", 1 / 60);
  }
  assert.equal(s.wordsDone, 1, "MESSI was never finished");
  assert.equal(s.mult, 2);
  assert.ok(s.jet > 0, "a finished name sets off the jet");
});
