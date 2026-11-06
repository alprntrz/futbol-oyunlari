import { other, resultOf, SERIES_TARGET, type HtCell, type Mark, type Winner } from "@/../mobile/src/lib/hattrick";
import { gridFromIds, squareCriteria, type GridIds } from "./saudiGrid";
import { validateCell } from "./tiki";

/** A series against the computer on the site, played in the browser by the same rules as server-games/ht.js (no comeback seconds). */

export const HUMAN: Mark = "X";
export const BOT: Mark = "O";
/** The computer knows only part of the list: with no draw offer on the site, this many turns in a row without a name end the game level. */
export const STALL_TURNS = 6;

export interface BotGame {
  grid: GridIds;
  board: (HtCell | null)[];
  turn: Mark;
  starter: Mark;
  winner: Winner;
  flash: { mark: Mark; reason: "wrong" | "skip" | "timeout" } | null;
  used: string[];
  idleTurns: number;
  endReason: "forfeit" | null;
  series: { X: number; O: number; target: number; over: boolean };
}

const freshGame = (grid: GridIds, starter: Mark) => ({
  grid,
  board: Array<HtCell | null>(9).fill(null),
  turn: starter,
  starter,
  winner: null,
  flash: null,
  used: [],
  idleTurns: 0,
  endReason: null,
});

export const newSeries = (grid: GridIds): BotGame => ({ ...freshGame(grid, HUMAN), series: { X: 0, O: 0, target: SERIES_TARGET, over: false } });

function settle(game: BotGame): BotGame {
  const winner = resultOf(game.board);
  if (!winner) return game;
  if (winner === "draw") return { ...game, winner };
  const wins = game.series[winner] + 1;
  return { ...game, winner, series: { ...game.series, [winner]: wins, over: wins >= SERIES_TARGET } };
}

function noName(game: BotGame, reason: "wrong" | "skip" | "timeout"): BotGame {
  const idleTurns = game.idleTurns + 1;
  return { ...game, idleTurns, turn: other(game.turn), flash: { mark: game.turn, reason }, winner: idleTurns >= STALL_TURNS ? "draw" : null };
}

/** `name` null, a name that doesn't fit, or a taken square is a wrong guess: the turn passes. */
export function play(game: BotGame, mark: Mark, cell: number, name: string | null): BotGame {
  if (game.winner || game.turn !== mark) return game;
  const grid = gridFromIds(game.grid);
  const player = grid && name && !game.board[cell] ? validateCell(name, ...squareCriteria(grid, cell), new Set(game.used)) : null;
  if (!player) return noName(game, "wrong");
  const board = game.board.map((c, i) => (i === cell ? { mark, name: player.name } : c));
  return settle({ ...game, board, used: [...game.used, player.name], turn: other(mark), flash: null, idleTurns: 0 });
}

export const passTurn = (game: BotGame, reason: "skip" | "timeout"): BotGame => (game.winner ? game : noName(game, reason));

export const forfeit = (game: BotGame): BotGame =>
  game.winner ? game : { ...game, winner: BOT, endReason: "forfeit", series: { ...game.series, [BOT]: game.series.target, over: true } };

/** The next game of the series, or a new series once it's decided; the other side starts. */
export const nextGame = (game: BotGame, grid: GridIds): BotGame => ({
  ...freshGame(grid, other(game.starter)),
  series: game.series.over ? { ...game.series, X: 0, O: 0, over: false } : game.series,
});
