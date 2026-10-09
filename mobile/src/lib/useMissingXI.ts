import { useState } from "react";

import type { Difficulty, Match, SlotState } from "@/lib/types";
import { answerLetters } from "@/lib/wordle";

import { haptic } from "./haptics";

export interface GameProgress {
  solved: number;
  failed: number;
  totalGuesses: number;
  done: boolean;
  won: boolean;
}

/**
 * Eksik 11 board state, ported from the web MissingXIGame. Unlike the web
 * version, giving up is part of the state so the daily screen can persist it.
 */
export function useMissingXI(
  match: Match,
  difficulty: Difficulty,
  initial?: { slots: SlotState[]; gaveUp: boolean },
  /** Called once by the move (guess or give-up) that ends the game */
  onFinish?: (won: boolean) => void
) {
  const maxGuesses = difficulty === "hard" ? 4 : 6;
  const [slots, setSlots] = useState<SlotState[]>(
    () => initial?.slots ?? match.lineup.map(() => ({ solved: false, failed: false, guesses: [] }))
  );
  const [gaveUp, setGaveUp] = useState(initial?.gaveUp ?? false);

  const solved = slots.filter((s) => s.solved).length;
  const failed = slots.filter((s) => s.failed).length;
  const totalGuesses = slots.reduce((a, s) => a + s.guesses.length, 0);
  const done = gaveUp || slots.every((s) => s.solved || s.failed);
  const won = !gaveUp && slots.every((s) => s.solved);
  const progress: GameProgress = { solved, failed, totalGuesses, done, won };

  const guess = (idx: number, g: string) => {
    const isRight = g === answerLetters(match.lineup[idx].answer);
    const next = slots.map((s, i) => {
      if (i !== idx) return s;
      const guesses = [...s.guesses, g];
      return { solved: isRight, failed: !isRight && guesses.length >= maxGuesses, guesses };
    });
    setSlots(next);
    if (next.every((s) => s.solved || s.failed)) onFinish?.(next.every((s) => s.solved));
    if (isRight) haptic.success();
    else if (next[idx].failed) haptic.error();
    else haptic.warning();
  };

  const giveUp = () => {
    setGaveUp(true);
    onFinish?.(false);
    haptic.error();
  };

  return { slots, gaveUp, guess, giveUp, maxGuesses, progress };
}
