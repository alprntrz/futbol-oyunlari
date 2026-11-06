import assert from "node:assert/strict";
import { test } from "node:test";

import { BOT, forfeit, HUMAN, newSeries, nextGame, passTurn, play, STALL_TURNS, type BotGame } from "@/lib/botMatch";
import { dailySeed, gridFromIds, gridToIds, saudiGrid, squareCriteria } from "@/lib/saudiGrid";
import { GRID_PLAYERS } from "@/lib/tiki";
import { botMove } from "@/../mobile/src/lib/htBot";

const ids = gridToIds(saudiGrid(dailySeed(20400)));

function fitFor(game: BotGame, cell: number) {
  const [row, col] = squareCriteria(gridFromIds(game.grid)!, cell);
  return GRID_PLAYERS.find((p) => row.test(p) && col.test(p) && !game.used.includes(p.name))!.name;
}

/** The human takes the top row while the bot only misses. */
function humanWinsGame(start: BotGame): BotGame {
  let game = start;
  if (game.turn === BOT) game = play(game, BOT, 8, null);
  for (const cell of [0, 1, 2]) {
    game = play(game, HUMAN, cell, fitFor(game, cell));
    if (!game.winner) game = play(game, BOT, 8, null);
  }
  return game;
}

test("a right name takes the square and passes the turn", () => {
  const game = newSeries(ids);
  const name = fitFor(game, 4);
  const after = play(game, HUMAN, 4, name);
  assert.deepEqual(after.board[4], { mark: HUMAN, name });
  assert.deepEqual(after.used, [name]);
  assert.equal(after.turn, BOT);
  assert.equal(after.flash, null);
  assert.equal(game.board[4], null, "the old state stays as it was");
});

test("a wrong, used or taken answer only passes the turn", () => {
  const game = newSeries(ids);
  const name = fitFor(game, 0);
  const wrong = play(game, HUMAN, 0, "Nobody At All");
  assert.equal(wrong.board[0], null);
  assert.deepEqual(wrong.flash, { mark: HUMAN, reason: "wrong" });
  assert.equal(wrong.turn, BOT);

  const taken = play(play(game, HUMAN, 0, name), BOT, 0, fitFor(game, 1));
  assert.equal(taken.board[0]?.mark, HUMAN);
  assert.equal(taken.flash?.reason, "wrong");

  const used = play(play(game, HUMAN, 0, name), BOT, 1, name);
  assert.equal(used.board[1], null);
});

test("a move out of turn or after the game changes nothing", () => {
  const game = newSeries(ids);
  assert.equal(play(game, BOT, 0, fitFor(game, 0)), game);
  const won = humanWinsGame(game);
  assert.equal(play(won, BOT, 5, fitFor(won, 5)), won);
  assert.equal(passTurn(won, "timeout"), won);
  assert.equal(forfeit(won), won);
});

test("skip and timeout pass the turn and say whose it was", () => {
  const game = newSeries(ids);
  assert.deepEqual(passTurn(game, "skip").flash, { mark: HUMAN, reason: "skip" });
  assert.equal(passTurn(game, "timeout").turn, BOT);
});

test("three in a row takes the game; first to three takes the series; the starter swaps", () => {
  let game = humanWinsGame(newSeries(ids));
  assert.equal(game.winner, HUMAN);
  assert.equal(game.series.X, 1);
  game = nextGame(game, ids);
  assert.equal(game.turn, BOT);
  assert.equal(game.winner, null);
  assert.deepEqual(game.used, []);
  game = humanWinsGame(game);
  game = humanWinsGame(nextGame(game, ids));
  assert.equal(game.series.over, true);
  const again = nextGame(game, ids);
  assert.deepEqual([again.series.X, again.series.O, again.series.over], [0, 0, false]);
});

test("turns in a row without a name end the game level; a name resets the count", () => {
  let game = newSeries(ids);
  for (let i = 0; i < STALL_TURNS - 1; i++) game = passTurn(game, "skip");
  assert.equal(game.winner, null);
  const named = play(game, game.turn, 0, fitFor(game, 0));
  assert.equal(named.idleTurns, 0);
  const level = passTurn(game, "timeout");
  assert.equal(level.winner, "draw");
  assert.deepEqual([level.series.X, level.series.O], [0, 0]);
});

test("forfeiting gives the computer the series", () => {
  const game = forfeit(newSeries(ids));
  assert.equal(game.winner, BOT);
  assert.equal(game.endReason, "forfeit");
  assert.equal(game.series.over, true);
});

test("the app's bot plays legal moves on Saudi grids and a game can finish", () => {
  for (let seed = 0; seed < 20; seed++) {
    let game = newSeries(gridToIds(saudiGrid(seed)));
    const grid = gridFromIds(game.grid)!;
    for (let turn = 0; turn < 400 && !game.winner; turn++) {
      const move = botMove(grid, game.board, game.used, game.turn);
      const before = game.board.filter(Boolean).length;
      game = play(game, game.turn, move.cell, move.name);
      if (move.name) assert.equal(game.board.filter(Boolean).length, before + 1, `seed ${seed}: ${move.name}`);
    }
    assert.ok(game.winner, `seed ${seed} never finished`);
  }
});
