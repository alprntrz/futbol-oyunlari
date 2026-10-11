import { ALL_CRITERIA, type Criterion } from "@/lib/tiki";

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
