"use client";

import { useEffect, useMemo, useState } from "react";

import { BOT, forfeit, HUMAN, newSeries, nextGame, passTurn, play, type BotGame } from "@/lib/botMatch";
import { dealRoomGrid, gridFromIds } from "@/lib/saudiGrid";
import { dict } from "@/lib/strings";
import { NEXT_GAME_MS, TURN_SECONDS } from "@/../mobile/src/lib/hattrick";
import { botMove, botThinkMs } from "@/../mobile/src/lib/htBot";
import { GridMatch } from "./GridMatch";

/** A series against the computer, all in the browser: no server, no socket. */

const TURN_MS = TURN_SECONDS * 1000;

export function BotRoom({ locale, onClose, onEvent }: {
  locale: "ar" | "en";
  onClose: () => void;
  onEvent: (event: "bot_start" | "bot_series_end") => void;
}) {
  const t = dict[locale];
  const [game, setGame] = useState(() => newSeries(dealRoomGrid()));
  const [deadline, setDeadline] = useState(() => Date.now() + TURN_MS);
  const grid = useMemo(() => gridFromIds(game.grid), [game.grid]);
  const seriesOver = game.series.over;

  const advance = (next: BotGame) => {
    setGame(next);
    setDeadline(Date.now() + TURN_MS);
  };

  useEffect(() => {
    onEvent("bot_start");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (seriesOver) onEvent("bot_series_end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesOver]);

  // every change of `game` is a new turn or a finished game
  useEffect(() => {
    if (game.series.over || !grid) return;
    if (game.winner) {
      const id = setTimeout(() => advance(nextGame(game, dealRoomGrid())), NEXT_GAME_MS);
      return () => clearTimeout(id);
    }
    const clock = setTimeout(() => advance(passTurn(game, "timeout")), TURN_MS);
    const thinkMs = game.turn === BOT ? botThinkMs() : null;
    const think = thinkMs === null ? undefined : setTimeout(() => {
      const move = botMove(grid, game.board, game.used, BOT);
      advance(play(game, BOT, move.cell, move.name));
    }, thinkMs);
    return () => {
      clearTimeout(clock);
      clearTimeout(think);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  if (!grid) return null;

  return (
    <GridMatch
      room={game}
      grid={grid}
      myMark={HUMAN}
      deadline={deadline}
      locale={locale}
      opponentName={t.gulfComputer}
      onMove={(cell, name) => advance(play(game, HUMAN, cell, name))}
      onSkip={() => advance(passTurn(game, "skip"))}
      onForfeit={() => advance(forfeit(game))}
      onClose={onClose}
    >
      <button
        type="button"
        onClick={() => {
          onEvent("bot_start");
          advance(nextGame(game, dealRoomGrid()));
        }}
        className="mt-3 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white"
      >
        {t.htRematch}
      </button>
    </GridMatch>
  );
}
