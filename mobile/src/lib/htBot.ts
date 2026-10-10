import { PLAYERS, type GridPlayer } from "@/data/players";
import type { Grid } from "@/lib/tiki";

import { LINES, type HtCell, type Mark } from "./hattrick";

/** Players a bot "knows": the better-known part of the list, so its answers look human. */
const KNOWN = PLAYERS.slice(0, 2500);

/** Every player who fits a square, best known first. */
export function answersFor(grid: Grid, cell: number): GridPlayer[] {
  const row = grid.rows[Math.floor(cell / 3)];
  const col = grid.cols[cell % 3];
  return PLAYERS.filter((p) => row.test(p) && col.test(p));
}

/**
 * How long the bot "thinks" before answering, in ms: usually a few seconds of
 * searching, sometimes much longer, and now and then it lets the clock run out (null).
 */
export function botThinkMs(): number | null {
  const r = Math.random();
  if (r < 0.04) return null;
  if (r < 0.2) return 16_000 + Math.random() * 18_000;
  return 4_000 + Math.random() * 11_000;
}

/** Takes a draw once the board is crowded, unless it's about to win. */
export function botTakesDraw(board: (HtCell | null)[], me: Mark): boolean {
  const open = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (finishing(board, me, open) !== undefined) return false;
  return 9 - open.length >= 5 || Math.random() < 0.15;
}

/** A square that would complete three in a row for `mark`, if any. */
function finishing(board: (HtCell | null)[], mark: Mark, open: number[]): number | undefined {
  return open.find((i) =>
    LINES.some((line) => line.includes(i) && line.every((j) => j === i || board[j]?.mark === mark))
  );
}

/**
 * The bot's move: win if it can, block if it must, otherwise prefer the centre.
 * It plays a little loose on purpose (sometimes a random square, sometimes a wrong
 * answer), so a decent player can beat it. `name` null means a wrong guess.
 */
export function botMove(grid: Grid, board: (HtCell | null)[], used: string[], me: Mark): { cell: number; name: string | null } {
  const taken = new Set(used);
  const options = (cell: number) => KNOWN.filter((p) => !taken.has(p.name) && grid.rows[Math.floor(cell / 3)].test(p) && grid.cols[cell % 3].test(p));
  const open = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  const answerable = open.filter((i) => options(i).length > 0);
  const pool = answerable.length ? answerable : open;

  const random = pool[Math.floor(Math.random() * pool.length)];
  const cell =
    Math.random() < 0.25
      ? random
      : (finishing(board, me, pool) ?? finishing(board, me === "X" ? "O" : "X", pool) ?? (pool.includes(4) ? 4 : random));

  const fits = options(cell);
  if (!fits.length || Math.random() < 0.15) return { cell, name: null };
  return { cell, name: fits[Math.floor(Math.random() * Math.min(fits.length, 12))].name };
}
