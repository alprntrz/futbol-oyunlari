import type { GridPlayer } from "@/data/players";
import { leagueGrid } from "./leagues";
import { seededRandom, type Criterion, type Grid } from "./tiki";

/** Rules of the web test site's daily Saudi grid: the app's solo grid, on `leagueGrid("sa")`. */

export const SA_TIME_LIMIT_MS = 180_000;

/** Names placed per square, row by row. */
export type Cells = string[][];

export const emptyCells = (): Cells => Array.from({ length: 9 }, () => []);

/** No World Cup squares: App Review flagged that trophy look, and ads would show it. */
const allowed = (c: Criterion) => !c.en.includes("World Cup");

export const saudiGrid = (seed: number): Grid => leagueGrid("sa", seededRandom(seed), allowed) ?? saudiGrid(seed + 1);

export const dailySeed = (day: number) => day * 7919 + 17;

/** The player's own calendar day, so the grid turns over at their midnight. */
export const localDay = (date = new Date()) => Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);

export const squareCriteria = (grid: Grid, i: number): [Criterion, Criterion] => [grid.rows[Math.floor(i / 3)], grid.cols[i % 3]];

/** Drops a player into every square they fit and don't fill yet. */
export function placePlayer(cells: Cells, grid: Grid, player: GridPlayer): { cells: Cells; fits: number; added: number } {
  const fits = cells.map((_, i) => i).filter((i) => squareCriteria(grid, i).every((c) => c.test(player)));
  const fresh = fits.filter((i) => !cells[i].includes(player.name));
  return { cells: cells.map((names, i) => (fresh.includes(i) ? [...names, player.name] : names)), fits: fits.length, added: fresh.length };
}

export const scoreOf = (cells: Cells) => ({ boxes: cells.filter((c) => c.length > 0).length, players: cells.reduce((n, c) => n + c.length, 0) });
