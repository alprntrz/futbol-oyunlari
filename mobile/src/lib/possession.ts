import type { GridPlayer } from "@/data/players";
import { ALL_CRITERIA, GRID_PLAYERS, type Criterion } from "@/lib/tiki";

import type { Mark } from "./hattrick";

/**
 * Possession Play: 31 hexes, each a criterion. On your turn pick a neutral hex
 * and name a footballer who fits it; every touching hex the footballer also fits
 * becomes yours too (including the opponent's: a steal). Each player has a chess
 * clock. When all hexes are claimed, more hexes wins; running out of time loses.
 */
export const ROWS = [4, 5, 4, 5, 4, 5, 4];
export const HEX_COUNT = ROWS.reduce((a, b) => a + b, 0); // 31
export const CLOCK_SECONDS = 120;

export interface PpCell {
  mark: Mark;
  name: string;
}

/** Hex index → [row, col]; narrow (4) rows sit half a hex to the right. */
export const POS: [number, number][] = ROWS.flatMap((len, r) => Array.from({ length: len }, (_, c) => [r, c] as [number, number]));

const indexOf = (r: number, c: number) => {
  if (r < 0 || r >= ROWS.length || c < 0 || c >= ROWS[r]) return -1;
  return ROWS.slice(0, r).reduce((a, b) => a + b, 0) + c;
};

/** Touching hexes: same row ±1, and two in each neighbouring row. */
export const NEIGHBOURS: number[][] = POS.map(([r, c]) => {
  const wide = ROWS[r] === 5;
  const adj = wide ? [c - 1, c] : [c, c + 1];
  return [indexOf(r, c - 1), indexOf(r, c + 1), ...adj.map((cc) => indexOf(r - 1, cc)), ...adj.map((cc) => indexOf(r + 1, cc))].filter((i) => i >= 0);
});

/** Hexes a move on `hex` with this footballer claims: the hex plus fitting neighbours not already mine. */
export function claimsFor(hex: number, fits: (c: Criterion) => boolean, board: Criterion[], owners: (PpCell | null)[], me: Mark): number[] {
  return [hex, ...NEIGHBOURS[hex].filter((n) => owners[n]?.mark !== me && fits(board[n]))];
}

export function resultOf(owners: (PpCell | null)[]): Mark | "draw" | null {
  if (!owners.every(Boolean)) return null;
  const x = owners.filter((o) => o?.mark === "X").length;
  return x === HEX_COUNT - x ? "draw" : x > HEX_COUNT - x ? "X" : "O";
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 31 different criteria: at most 3 honours so most hexes are clubs and countries. */
export function generateBoard(): Criterion[] {
  const badges = ALL_CRITERIA.filter((c) => c.kind === "badge");
  const rest = ALL_CRITERIA.filter((c) => c.kind !== "badge");
  return shuffle([...shuffle(badges).slice(0, 3), ...shuffle(rest).slice(0, HEX_COUNT - 3)]);
}

export const boardToIds = (b: Criterion[]) => b.map((c) => c.id);
export const boardFromIds = (ids: string[]) => ids.map((id) => ALL_CRITERIA.find((c) => c.id === id)!);

/** players the house player "knows": the better-known part of the list, so its names sound human */
const KNOWN = GRID_PLAYERS.slice(0, 2500);

/**
 * The house player's move (random-queue fallback): a free hex and a well-known footballer
 * for it, leaning to moves that take more hexes (steals count double), with some noise so a
 * decent player can beat it; now and then a wrong answer (`player` null).
 */
export function housePpMove(board: Criterion[], owners: (PpCell | null)[], used: string[], me: Mark): { hex: number; player: GridPlayer | null } {
  const free = owners.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
  const hex0 = free[Math.floor(Math.random() * free.length)];
  if (Math.random() < 0.12) return { hex: hex0, player: null };
  const taken = new Set(used);
  let best: { hex: number; player: GridPlayer; score: number } | null = null;
  // a person looks at a few hexes, not all of them
  for (const hex of free.sort(() => Math.random() - 0.5).slice(0, 8)) {
    const fits = KNOWN.filter((p) => !taken.has(p.name) && board[hex].test(p)).slice(0, 40);
    for (const p of fits.sort(() => Math.random() - 0.5).slice(0, 8)) {
      const claims = claimsFor(hex, (c) => c.test(p), board, owners, me);
      const score = claims.reduce((n, i) => n + (owners[i] ? 2 : 1), 0) + Math.random() * 1.5;
      if (!best || score > best.score) best = { hex, player: p, score };
    }
  }
  return best ? { hex: best.hex, player: best.player } : { hex: hex0, player: null };
}

/** How long the house player "thinks", in ms. */
export const housePpThinkMs = () => (Math.random() < 0.15 ? 9_000 + Math.random() * 6_000 : 3_000 + Math.random() * 5_000);
