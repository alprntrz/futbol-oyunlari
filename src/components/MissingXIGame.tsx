"use client";

import { useEffect, useRef, useState } from "react";
import { FORMATIONS } from "@/lib/formations";
import { useI18n } from "@/lib/i18n";
import type { Difficulty, Match, SlotState } from "@/lib/types";
import { GuessModal } from "./GuessModal";
import { Jersey } from "./Jersey";

export interface GameProgress {
  solved: number;
  failed: number;
  totalGuesses: number;
  done: boolean;
  won: boolean;
}

export function MissingXIGame({
  match,
  difficulty,
  initialSlots,
  onProgress,
  onStateChange,
  headerExtra,
}: {
  match: Match;
  difficulty: Difficulty;
  initialSlots?: SlotState[];
  onProgress?: (p: GameProgress) => void;
  onStateChange?: (slots: SlotState[]) => void;
  headerExtra?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const maxGuesses = difficulty === "hard" ? 4 : 6;
  const [slots, setSlots] = useState<SlotState[]>(
    () =>
      initialSlots ??
      match.lineup.map(() => ({ solved: false, failed: false, guesses: [] }))
  );
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const positions = FORMATIONS[match.formation];

  const solvedCount = slots.filter((s) => s.solved).length;
  const failedCount = slots.filter((s) => s.failed).length;
  const totalGuesses = slots.reduce((a, s) => a + s.guesses.length, 0);
  const done = gaveUp || slots.every((s) => s.solved || s.failed);
  const won = !gaveUp && slots.every((s) => s.solved);

  // Latest callbacks, kept in refs so the effects below don't re-run when a
  // parent passes a new function. Declared first so it runs before them.
  const progressRef = useRef(onProgress);
  const stateRef = useRef(onStateChange);
  useEffect(() => {
    progressRef.current = onProgress;
    stateRef.current = onStateChange;
  });

  useEffect(() => {
    progressRef.current?.({
      solved: solvedCount,
      failed: failedCount,
      totalGuesses,
      done,
      won,
    });
    stateRef.current?.(slots);
  }, [slots, solvedCount, failedCount, totalGuesses, done, won]);

  const handleGuess = (idx: number, guess: string) => {
    setSlots((prev) => {
      const next = prev.map((s, i) => {
        if (i !== idx) return s;
        const guesses = [...s.guesses, guess];
        const solved = guess === match.lineup[idx].answer.replace(/ /g, "");
        const failed = !solved && guesses.length >= maxGuesses;
        return { solved, failed, guesses };
      });
      return next;
    });
  };

  // Close the modal automatically when its slot resolves
  useEffect(() => {
    if (openSlot !== null) {
      const s = slots[openSlot];
      if (s.solved || s.failed) {
        const timer = setTimeout(() => setOpenSlot(null), s.solved ? 500 : 900);
        return () => clearTimeout(timer);
      }
    }
  }, [slots, openSlot]);

  const comp = match.competition[locale];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center">
      {/* Scoreboard */}
      <div className="mb-2 w-full text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
          {comp} · {match.season}
        </div>
        <div className="mt-1 flex items-center justify-center gap-3">
          <span className="text-lg font-black text-white">{match.team}</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-lg font-bold text-emerald-300">
            {match.score}
          </span>
          <span className="text-lg font-bold text-zinc-400">{match.opponent}</span>
        </div>
        <div className="text-xs text-zinc-500">
          {match.date} · {match.team} {t("guessThe")}
        </div>
        {headerExtra}
      </div>

      {/* Pitch */}
      <div
        className="relative w-full overflow-hidden rounded-xl border-4 border-emerald-900"
        style={{
          aspectRatio: "3/4",
          background:
            "repeating-linear-gradient(0deg, #2e9e44 0 12.5%, #37b350 12.5% 25%)",
        }}
      >
        {/* pitch markings */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
          <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/60" />
          <div className="absolute left-1/2 top-0 h-14 w-44 -translate-x-1/2 border-2 border-t-0 border-white/60" />
          <div className="absolute bottom-0 left-1/2 h-14 w-44 -translate-x-1/2 border-2 border-b-0 border-white/60" />
        </div>

        {match.lineup.map((p, i) => {
          const pos = positions[i];
          const s = slots[i];
          const revealed = s.solved || (done && !s.solved);
          return (
            <button
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 focus:outline-none"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={() => !done && !s.solved && !s.failed && setOpenSlot(i)}
              disabled={done || s.solved || s.failed}
            >
              <div className="flex flex-col items-center gap-0.5">
                <Jersey
                  body={match.kit.body}
                  sleeves={match.kit.sleeves}
                  numberColor={match.kit.number}
                  number={p.number}
                  captain={p.captain}
                  goals={p.goals}
                  faded={s.failed && !done}
                  size={52}
                />
                <div
                  className={`flex min-w-12 items-center justify-center rounded-sm border px-1 py-0.5 text-[10px] font-bold leading-none ${
                    s.solved
                      ? "border-emerald-700 bg-emerald-500 text-white"
                      : s.failed
                        ? "border-red-800 bg-red-500/90 text-white"
                        : "border-zinc-700 bg-white text-zinc-800"
                  }`}
                >
                  {revealed ? (
                    <span className="whitespace-nowrap">{p.name}</span>
                  ) : (
                    <span className="whitespace-pre tracking-[2px] text-zinc-500">
                      {p.answer
                        .slice(0, 14)
                        .split("")
                        .map((ch) => (ch === " " ? " " : "·"))
                        .join("")}
                      {s.guesses.length > 0 && (
                        <span className="ml-1 rounded bg-zinc-800 px-0.5 text-[9px] text-white">
                          {s.guesses.length}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer bar */}
      <div className="mt-3 flex w-full items-center justify-between">
        <div className="font-mono text-lg font-black text-white">
          {solvedCount}
          <span className="text-zinc-500">/11</span>
          <span className="ml-3 text-sm font-normal text-zinc-400">
            {t("totalGuesses")}: {totalGuesses}
          </span>
        </div>
        {!done && (
          <button
            onClick={() => setGaveUp(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
          >
            {t("giveUp")}
          </button>
        )}
      </div>

      {openSlot !== null && !done && (
        <GuessModal
          player={match.lineup[openSlot]}
          difficulty={difficulty}
          pastGuesses={slots[openSlot].guesses}
          onGuess={(g) => handleGuess(openSlot, g)}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </div>
  );
}
