/**
 * Kombine: a football match-3. Pure game rules, no React.
 *
 * The board is rows × cols of tiles. Three or more of a colour in a line clear;
 * bigger matches leave a special tile behind:
 *   4 in a row  → "row"/"col" (Şut: clears that line)
 *   L or T      → "bomb"      (Kafa: clears the 3×3 around it)
 *   5 in a row  → "color"     (Frikik: clears every tile of one colour)
 * Balls are colourless items: they can't be matched, they fall, and a ball that
 * reaches the bottom row is a goal. A ball can also be dribbled: swapped one cell
 * without making a match, for a move. Mud sits under tiles and goes when a tile on
 * it is cleared.
 *
 * `swap` returns the turn as a list of phases (board snapshots) for the UI to animate.
 */

export type Special = "row" | "col" | "bomb" | "color";

export interface Tile {
  id: number;
  /** 0..colors-1; -1 for balls and colour bombs */
  color: number;
  special?: Special;
  ball?: boolean;
}

export type Grid = (Tile | null)[][];
export interface Pos {
  r: number;
  c: number;
}

export type Goal = { kind: "color"; color: number; count: number } | { kind: "ball"; count: number } | { kind: "mud" } | { kind: "score"; count: number };

export interface Level {
  moves: number;
  /** how many tile colours are in play (4-6): fewer is easier */
  colors: number;
  goals: Goal[];
  /** "#" marks a mud cell, one string per row */
  mud?: string[];
  /** balls on the board at kick-off */
  balls?: number;
  rows?: number;
  cols?: number;
}

export type Phase =
  | { kind: "swap"; grid: Grid }
  | { kind: "unswap"; grid: Grid }
  | { kind: "clear"; grid: Grid; cleared: { tile: Tile; pos: Pos }[]; blasts: Pos[] }
  | { kind: "fall"; grid: Grid; spawned: Record<number, number> }
  | { kind: "goal"; grid: Grid; scored: { tile: Tile; pos: Pos }[] }
  | { kind: "shuffle"; grid: Grid };

export interface Game {
  level: Level;
  rows: number;
  cols: number;
  grid: Grid;
  mud: boolean[][];
  movesLeft: number;
  score: number;
  /** tiles cleared per colour */
  collected: number[];
  goalsScored: number;
  ballsSpawned: number;
  rand: () => number;
  nextId: number;
}

const copy = (g: Grid): Grid => g.map((row) => row.slice());
const key = (p: Pos) => p.r * 100 + p.c;
const unkey = (k: number): Pos => ({ r: Math.floor(k / 100), c: k % 100 });

function newTile(g: Game, color?: number): Tile {
  return { id: g.nextId++, color: color ?? Math.floor(g.rand() * g.level.colors) };
}

const ballTile = (g: Game): Tile => ({ id: g.nextId++, color: -1, ball: true });
const matchable = (t: Tile | null): t is Tile => !!t && !t.ball && t.color >= 0;

export function ballTarget(level: Level) {
  return level.goals.reduce((n, goal) => (goal.kind === "ball" ? n + goal.count : n), 0);
}

// ---------------------------------------------------------------- setup

export function newGame(level: Level, rand: () => number): Game {
  const rows = level.rows ?? 8;
  const cols = level.cols ?? 8;
  const g: Game = {
    level,
    rows,
    cols,
    grid: [],
    mud: Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => level.mud?.[r]?.[c] === "#")),
    movesLeft: level.moves,
    score: 0,
    collected: Array(6).fill(0),
    goalsScored: 0,
    ballsSpawned: 0,
    rand,
    nextId: 1,
  };
  for (let tries = 0; tries < 50; tries++) {
    g.grid = Array.from({ length: rows }, () => Array<Tile | null>(cols).fill(null));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        // pick a colour that doesn't complete a line on the spot
        let t: Tile;
        do t = newTile(g);
        while (
          (c >= 2 && g.grid[r][c - 1]?.color === t.color && g.grid[r][c - 2]?.color === t.color) ||
          (r >= 2 && g.grid[r - 1][c]?.color === t.color && g.grid[r - 2][c]?.color === t.color)
        );
        g.grid[r][c] = t;
      }
    // balls start in the top rows, in different columns
    const ballCols = new Set<number>();
    while (ballCols.size < Math.min(level.balls ?? 0, cols)) ballCols.add(Math.floor(rand() * cols));
    for (const c of ballCols) g.grid[Math.floor(rand() * 2)][c] = ballTile(g);
    g.ballsSpawned = ballCols.size;
    if (findMove(g)) break;
  }
  return g;
}

// ---------------------------------------------------------------- matching

interface Run {
  cells: Pos[];
  horizontal: boolean;
}

function findRuns(grid: Grid, rows: number, cols: number): Run[] {
  const runs: Run[] = [];
  for (let r = 0; r < rows; r++) {
    let start = 0;
    for (let c = 1; c <= cols; c++) {
      const a = grid[r][start];
      const b = c < cols ? grid[r][c] : null;
      if (c < cols && matchable(a) && matchable(b) && a.color === b.color) continue;
      if (c - start >= 3 && matchable(a)) runs.push({ horizontal: true, cells: Array.from({ length: c - start }, (_, i) => ({ r, c: start + i })) });
      start = c;
    }
  }
  for (let c = 0; c < cols; c++) {
    let start = 0;
    for (let r = 1; r <= rows; r++) {
      const a = grid[start][c];
      const b = r < rows ? grid[r][c] : null;
      if (r < rows && matchable(a) && matchable(b) && a.color === b.color) continue;
      if (r - start >= 3 && matchable(a)) runs.push({ horizontal: false, cells: Array.from({ length: r - start }, (_, i) => ({ r: start + i, c })) });
      start = r;
    }
  }
  return runs;
}

/** Cells a special clears when it goes off. */
function blastArea(g: Game, t: Tile, p: Pos, grid: Grid): Pos[] {
  const out: Pos[] = [];
  if (t.special === "row") for (let c = 0; c < g.cols; c++) out.push({ r: p.r, c });
  if (t.special === "col") for (let r = 0; r < g.rows; r++) out.push({ r, c: p.c });
  if (t.special === "bomb")
    for (let r = p.r - 1; r <= p.r + 1; r++) for (let c = p.c - 1; c <= p.c + 1; c++) if (r >= 0 && c >= 0 && r < g.rows && c < g.cols) out.push({ r, c });
  if (t.special === "color") {
    // the colour with the most tiles on the board
    const counts = Array(g.level.colors).fill(0);
    grid.forEach((row) => row.forEach((x) => matchable(x) && counts[x.color]++));
    const color = counts.indexOf(Math.max(...counts));
    grid.forEach((row, r) => row.forEach((x, c) => matchable(x) && x.color === color && out.push({ r, c })));
  }
  return out;
}

/**
 * Clears `seed` cells, setting off any specials among them (and any those reach).
 * Returns what was cleared; `keep` cells are spared (a special being created there).
 */
function clearCells(g: Game, grid: Grid, seed: Pos[], keep: Set<number>, cascade: number) {
  const queue = [...seed];
  const done = new Set<number>();
  const cleared: { tile: Tile; pos: Pos }[] = [];
  const blasts: Pos[] = [];
  while (queue.length) {
    const p = queue.shift()!;
    const k = key(p);
    if (done.has(k) || keep.has(k)) continue;
    done.add(k);
    const t = grid[p.r][p.c];
    if (!t || t.ball) continue;
    cleared.push({ tile: t, pos: p });
    grid[p.r][p.c] = null;
    if (t.special) {
      blasts.push(p);
      queue.push(...blastArea(g, t, p, grid));
    }
  }
  for (const { tile, pos } of cleared) {
    if (tile.color >= 0) g.collected[tile.color]++;
    if (g.mud[pos.r][pos.c]) g.mud[pos.r][pos.c] = false;
    g.score += 20 * cascade + (tile.special ? 60 : 0);
  }
  return { cleared, blasts };
}

/** Resolves all current runs: clears them and leaves specials where big matches were. */
function resolveRuns(g: Game, grid: Grid, runs: Run[], swapped: Pos[], cascade: number) {
  const keep = new Set<number>();
  const created: { pos: Pos; tile: Tile }[] = [];
  const used = new Set<Run>();
  const inRun = (run: Run, p: Pos) => run.cells.some((x) => x.r === p.r && x.c === p.c);
  const pivotOf = (run: Run) => swapped.find((p) => inRun(run, p)) ?? run.cells[Math.floor(run.cells.length / 2)];
  const make = (p: Pos, special: Special, color: number) => {
    if (keep.has(key(p))) return;
    keep.add(key(p));
    created.push({ pos: p, tile: { id: g.nextId++, color: special === "color" ? -1 : color, special } });
  };

  for (const run of runs)
    if (run.cells.length >= 5) {
      used.add(run);
      make(pivotOf(run), "color", -1);
    }
  for (const h of runs)
    for (const v of runs) {
      if (!h.horizontal || v.horizontal || used.has(h) || used.has(v)) continue;
      const cross = h.cells.find((p) => inRun(v, p));
      if (!cross) continue;
      used.add(h);
      used.add(v);
      make(cross, "bomb", grid[cross.r][cross.c]!.color);
    }
  for (const run of runs)
    if (run.cells.length === 4 && !used.has(run)) {
      const p = pivotOf(run);
      make(p, run.horizontal ? "row" : "col", grid[p.r][p.c]!.color);
    }

  // A special that is itself part of a new match goes off rather than being replaced
  for (const { pos } of created) {
    const old = grid[pos.r][pos.c];
    if (old?.special) keep.delete(key(pos));
  }

  const seed = runs.flatMap((r) => r.cells);
  const res = clearCells(g, grid, seed, keep, cascade);
  for (const { pos, tile } of created) if (keep.has(key(pos))) grid[pos.r][pos.c] = tile;
  return res;
}

// ---------------------------------------------------------------- gravity

function gravity(g: Game, grid: Grid) {
  const spawned: Record<number, number> = {};
  const wantBalls = ballTarget(g.level) - g.ballsSpawned;
  let ballCol = wantBalls > 0 && g.rand() < 0.35 ? Math.floor(g.rand() * g.cols) : -1;
  for (let c = 0; c < g.cols; c++) {
    const stack: Tile[] = [];
    for (let r = g.rows - 1; r >= 0; r--) if (grid[r][c]) stack.push(grid[r][c]!);
    const missing = g.rows - stack.length;
    for (let r = g.rows - 1, i = 0; r >= 0; r--, i++) grid[r][c] = stack[i] ?? null;
    for (let i = 0; i < missing; i++) {
      const r = missing - 1 - i;
      let t: Tile;
      if (c === ballCol && i === 0) {
        t = ballTile(g);
        g.ballsSpawned++;
        ballCol = -1;
      } else t = newTile(g);
      grid[r][c] = t;
      spawned[t.id] = r - missing;
    }
  }
  return spawned;
}

/** Balls resting on the bottom row are goals: take them off. */
function collectBalls(g: Game, grid: Grid) {
  const scored: { tile: Tile; pos: Pos }[] = [];
  const r = g.rows - 1;
  for (let c = 0; c < g.cols; c++) {
    const t = grid[r][c];
    if (t?.ball) {
      scored.push({ tile: t, pos: { r, c } });
      grid[r][c] = null;
      g.goalsScored++;
      g.score += 300;
    }
  }
  return scored;
}

// ---------------------------------------------------------------- moves

export const adjacent = (a: Pos, b: Pos) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

function swapIn(grid: Grid, a: Pos, b: Pos) {
  const t = grid[a.r][a.c];
  grid[a.r][a.c] = grid[b.r][b.c];
  grid[b.r][b.c] = t;
}

/** Does swapping a and b do anything? */
function swapWorks(g: Game, grid: Grid, a: Pos, b: Pos) {
  const ta = grid[a.r][a.c];
  const tb = grid[b.r][b.c];
  if (!ta || !tb) return false;
  if (ta.ball || tb.ball) return !(ta.ball && tb.ball);
  if (ta.special === "color" || tb.special === "color") return !ta.ball && !tb.ball;
  if (ta.special && tb.special) return true;
  swapIn(grid, a, b);
  const ok = findRuns(grid, g.rows, g.cols).length > 0;
  swapIn(grid, a, b);
  return ok;
}

/** Any swap that makes a match, or null when the board is stuck. */
export function findMove(g: Game): [Pos, Pos] | null {
  const grid = copy(g.grid);
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      if (c + 1 < g.cols && swapWorks(g, grid, { r, c }, { r, c: c + 1 })) return [{ r, c }, { r, c: c + 1 }];
      if (r + 1 < g.rows && swapWorks(g, grid, { r, c }, { r: r + 1, c })) return [{ r, c }, { r: r + 1, c }];
    }
  return null;
}

function shuffle(g: Game) {
  for (let tries = 0; tries < 100; tries++) {
    const tiles: Tile[] = [];
    const cells: Pos[] = [];
    g.grid.forEach((row, r) => row.forEach((t, c) => t && !t.ball && (tiles.push(t), cells.push({ r, c }))));
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(g.rand() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    cells.forEach((p, i) => (g.grid[p.r][p.c] = tiles[i]));
    if (!findRuns(g.grid, g.rows, g.cols).length && findMove(g)) return;
  }
}

/** Settles the board after something was cleared: falls, goals and new matches, until still. */
function settle(g: Game, grid: Grid, phases: Phase[], startCascade: number) {
  let cascade = startCascade;
  for (let guard = 0; guard < 60; guard++) {
    const spawned = gravity(g, grid);
    phases.push({ kind: "fall", grid: copy(grid), spawned });
    const scored = collectBalls(g, grid);
    if (scored.length) {
      phases.push({ kind: "goal", grid: copy(grid), scored });
      continue;
    }
    const runs = findRuns(grid, g.rows, g.cols);
    if (!runs.length) break;
    cascade++;
    const res = resolveRuns(g, grid, runs, [], cascade);
    phases.push({ kind: "clear", grid: copy(grid), ...res });
  }
  g.grid = grid;
  if (!findMove(g)) {
    shuffle(g);
    phases.push({ kind: "shuffle", grid: copy(g.grid) });
  }
}

/** Plays a swap. An invalid swap comes back as swap + unswap and costs nothing. */
export function swap(g: Game, a: Pos, b: Pos): Phase[] {
  if (!adjacent(a, b) || g.movesLeft <= 0) return [];
  const grid = copy(g.grid);
  const ta = grid[a.r][a.c];
  const tb = grid[b.r][b.c];
  if (!ta || !tb) return [];
  swapIn(grid, a, b);
  const phases: Phase[] = [{ kind: "swap", grid: copy(grid) }];

  // Specials swapped together go off straight away
  const colorBomb = ta.special === "color" ? { bomb: b, other: tb } : tb.special === "color" ? { bomb: a, other: ta } : null;
  if (colorBomb && !colorBomb.other.ball) {
    g.movesLeft--;
    const { other } = colorBomb;
    const seed: Pos[] = [colorBomb.bomb];
    if (other.special === "color") grid.forEach((row, r) => row.forEach((_, c) => seed.push({ r, c })));
    else grid.forEach((row, r) => row.forEach((x, c) => matchable(x) && x.color === other.color && seed.push({ r, c })));
    // the bomb itself shouldn't pick a second colour when cleared
    grid[colorBomb.bomb.r][colorBomb.bomb.c] = { ...grid[colorBomb.bomb.r][colorBomb.bomb.c]!, special: undefined };
    const res = clearCells(g, grid, seed, new Set(), 1);
    phases.push({ kind: "clear", grid: copy(grid), ...res });
    settle(g, grid, phases, 1);
    return phases;
  }
  if (ta.special && tb.special) {
    g.movesLeft--;
    const res = clearCells(g, grid, [a, b], new Set(), 1);
    phases.push({ kind: "clear", grid: copy(grid), ...res });
    settle(g, grid, phases, 1);
    return phases;
  }

  const runs = findRuns(grid, g.rows, g.cols);
  if (!runs.length && (ta.ball || tb.ball) && !(ta.ball && tb.ball)) {
    // a dribble: the ball moves one cell, nothing clears
    g.movesLeft--;
    settle(g, grid, phases, 1);
    return phases;
  }
  if (!runs.length) {
    swapIn(grid, a, b);
    phases.push({ kind: "unswap", grid: copy(grid) });
    return phases;
  }
  g.movesLeft--;
  const res = resolveRuns(g, grid, runs, [a, b], 1);
  phases.push({ kind: "clear", grid: copy(grid), ...res });
  settle(g, grid, phases, 1);
  return phases;
}

// ---------------------------------------------------------------- goals

export function goalProgress(g: Game, goal: Goal): { have: number; need: number } {
  if (goal.kind === "color") return { have: Math.min(g.collected[goal.color], goal.count), need: goal.count };
  if (goal.kind === "ball") return { have: Math.min(g.goalsScored, goal.count), need: goal.count };
  if (goal.kind === "score") return { have: Math.min(g.score, goal.count), need: goal.count };
  const total = g.level.mud?.join("").split("#").length ?? 1;
  const left = g.mud.flat().filter(Boolean).length;
  return { have: total - 1 - left, need: total - 1 };
}

export const won = (g: Game) => g.level.goals.every((goal) => {
  const p = goalProgress(g, goal);
  return p.have >= p.need;
});

export const lost = (g: Game) => !won(g) && g.movesLeft <= 0;

/** 1-3 stars from the moves left over when the game was won. */
export function stars(g: Game): number {
  if (!won(g)) return 0;
  const spare = g.movesLeft / g.level.moves;
  return spare >= 0.3 ? 3 : spare >= 0.12 ? 2 : 1;
}

export { key as posKey, unkey as posFromKey };
