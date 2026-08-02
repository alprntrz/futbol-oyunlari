"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { MissingXIGame, type GameProgress } from "@/components/MissingXIGame";
import { ResultPanel } from "@/components/ResultPanel";
import { randomMatch } from "@/lib/daily";
import { useI18n } from "@/lib/i18n";
import type { Difficulty, Match, SlotState } from "@/lib/types";
import { GameNav, type GameNavKey } from "./GameNav";

/** Shared random-match practice flow, parameterized by the match pool. */
export function PracticeMode({
  pool,
  navActive,
  emptyText,
}: {
  pool: Match[];
  navActive: GameNavKey;
  emptyText?: string;
}) {
  const { t } = useI18n();
  const [match, setMatch] = useState<Match | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [slots, setSlots] = useState<SlotState[] | null>(null);
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const newGame = (d: Difficulty) => {
    setDifficulty(d);
    setMatch(randomMatch(match?.id, pool));
    setSlots(null);
    setProgress(null);
    setGameKey((k) => k + 1);
  };

  return (
    <div className="flex flex-1 flex-col items-center">
      <Header />
      <main className="flex w-full max-w-lg flex-1 flex-col items-center px-3 pb-10">
        <GameNav active={navActive} />

        {pool.length === 0 ? (
          <p className="py-10 text-center text-zinc-400">{emptyText}</p>
        ) : !match ? (
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => newGame("normal")}
              className="rounded-xl bg-indigo-600 p-4 text-left hover:bg-indigo-500"
            >
              <div className="text-lg font-black text-white">{t("normal")}</div>
              <div className="text-sm text-indigo-200">{t("normalDesc")}</div>
            </button>
            <button
              onClick={() => newGame("hard")}
              className="rounded-xl bg-rose-600 p-4 text-left hover:bg-rose-500"
            >
              <div className="text-lg font-black text-white">{t("hard")}</div>
              <div className="text-sm text-rose-200">{t("hardDesc")}</div>
            </button>
          </div>
        ) : (
          <>
            <MissingXIGame
              key={gameKey}
              match={match}
              difficulty={difficulty}
              onProgress={setProgress}
              onStateChange={setSlots}
            />
            {progress?.done && slots && (
              <ResultPanel
                match={match}
                slots={slots}
                won={progress.won}
                onPlayAgain={() => newGame(difficulty)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
