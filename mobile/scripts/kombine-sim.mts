/**
 * Plays every Kombine level many times with a simple bot and prints win rates,
 * plus engine sanity checks. Run: node mobile/scripts/kombine-sim.mts [games]
 *
 * The bot picks, among all valid swaps, the one that clears the most this turn
 * (with some randomness). It weighs every swap each turn, so it plays better
 * than a casual player: aim for ~100% early, 85-95% mid, 65-80% late.
 */
import { findMove, goalProgress, lost, newGame, swap, won, type Game, type Pos } from "../src/lib/kombine/engine.ts";
import { SEASON } from "../src/lib/kombine/levels.ts";

const GAMES = Number(process.argv[2] ?? 300);

function clone(g: Game): Game {
  return { ...g, grid: g.grid.map((r) => r.slice()), mud: g.mud.map((r) => r.slice()), collected: g.collected.slice() };
}

function candidates(g: Game): [Pos, Pos][] {
  const out: [Pos, Pos][] = [];
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      if (c + 1 < g.cols) out.push([{ r, c }, { r, c: c + 1 }]);
      if (r + 1 < g.rows) out.push([{ r, c }, { r: r + 1, c }]);
    }
  return out;
}

/** Value of a finished turn towards the level goals. */
function value(before: Game, after: Game) {
  let v = 0;
  for (const goal of after.level.goals) {
    const a = goalProgress(before, goal);
    const b = goalProgress(after, goal);
    v += ((b.have - a.have) / Math.max(1, b.need)) * 100;
  }
  // players steer balls down on purpose: count how far they dropped
  const ballDepth = (g: Game) => g.grid.reduce((n, row, r) => n + row.filter((t) => t?.ball).length * r, 0) + g.goalsScored * g.rows;
  if (after.level.goals.some((goal) => goal.kind === "ball")) v += (ballDepth(after) - ballDepth(before)) * 4;
  return v + (after.score - before.score) / 400;
}

function check(g: Game) {
  for (const row of g.grid) for (const t of row) if (!t) throw new Error("hole left on the board");
  const ids = new Set(g.grid.flat().map((t) => t!.id));
  if (ids.size !== g.rows * g.cols) throw new Error("duplicate tile ids");
  if (!findMove(g)) throw new Error("stuck board without shuffle");
}

let seed = 12345;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

for (const [i, level] of SEASON.entries()) {
  let wins = 0;
  let movesLeftSum = 0;
  for (let n = 0; n < GAMES; n++) {
    const g = newGame(level, rand);
    check(g);
    while (!won(g) && !lost(g)) {
      let best: [Pos, Pos] | null = null;
      let bestV = -1;
      for (const [a, b] of candidates(g)) {
        const trial = clone(g);
        // keep the trial's dice separate so the real game isn't affected
        const phases = swap(trial, a, b);
        if (phases.length < 2 || phases[1].kind === "unswap") continue;
        const v = value(g, trial) + rand() * 4;
        if (v > bestV) [best, bestV] = [[a, b], v];
      }
      if (!best) throw new Error("no valid move found");
      swap(g, best[0], best[1]);
      check(g);
    }
    if (won(g)) {
      wins++;
      movesLeftSum += g.movesLeft;
    }
  }
  const rate = Math.round((wins / GAMES) * 100);
  console.log(`${String(i + 1).padStart(2)} ${level.rival.padEnd(11)} win ${String(rate).padStart(3)}%  avg moves left ${wins ? (movesLeftSum / wins).toFixed(1) : "-"}`);
}
