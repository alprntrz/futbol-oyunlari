"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { evaluateGuess, keyboardState } from "@/lib/wordle";
import type { Difficulty, LineupPlayer, TileMark } from "@/lib/types";
import { Keyboard } from "./Keyboard";

function Tile({ ch, mark, small }: { ch: string; mark?: TileMark; small?: boolean }) {
  const bg =
    mark === "correct"
      ? "bg-emerald-500 border-emerald-500 text-white"
      : mark === "present"
        ? "bg-amber-400 border-amber-400 text-black"
        : mark === "absent"
          ? "bg-zinc-700 border-zinc-700 text-zinc-300"
          : ch
            ? "border-zinc-400 text-white"
            : "border-zinc-600";
  const size = small ? "h-8 w-8 text-sm" : "h-11 w-11 text-xl";
  return (
    <div
      className={`flex items-center justify-center rounded border-2 font-black uppercase ${size} ${bg}`}
    >
      {ch}
    </div>
  );
}

export function GuessModal({
  player,
  difficulty,
  pastGuesses,
  onGuess,
  onClose,
}: {
  player: LineupPlayer;
  difficulty: Difficulty;
  pastGuesses: string[];
  /** returns after recording; parent decides solved/failed state */
  onGuess: (guess: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  // display form may contain word-boundary spaces ("DI MARIA");
  // guessing always happens on the letters only
  const display = player.answer;
  const answer = display.replace(/ /g, "");
  const maxGuesses = difficulty === "hard" ? 4 : 6;
  const [current, setCurrent] = useState("");
  const [shake, setShake] = useState(false);

  const showHint =
    difficulty === "normal" &&
    pastGuesses.length >= 3 &&
    !pastGuesses.some((g) => g[0] === answer[0]);

  const submit = useCallback(() => {
    if (current.length !== answer.length) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    onGuess(current);
    setCurrent("");
  }, [current, answer.length, onGuess]);

  const handleKey = useCallback(
    (key: string) => {
      if (key === "ENTER") return submit();
      if (key === "DELETE") return setCurrent((c) => c.slice(0, -1));
      if (/^[A-Z]$/.test(key))
        setCurrent((c) => (c.length < answer.length ? c + key : c));
    },
    [submit, answer.length]
  );

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Return" || e.keyCode === 13)
        handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("DELETE");
      else if (e.key === "Escape") onClose();
      else {
        const ch = e.key.toUpperCase();
        if (/^[A-ZÇĞİÖŞÜ]$/.test(ch)) {
          const map: Record<string, string> = { Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" };
          handleKey(map[ch] ?? ch);
        }
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handleKey, onClose]);

  const kb = keyboardState(pastGuesses, answer);
  const guessesLeft = maxGuesses - pastGuesses.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-zinc-900 p-4 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            #{player.number} · {answer.length}{" "}
            {t("guess").toLowerCase()} {guessesLeft}/{maxGuesses}
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-col items-center gap-1.5">
          {pastGuesses.map((g, i) => {
            const marks = evaluateGuess(g, answer);
            let li = -1;
            return (
              <div key={i} className="flex items-center gap-1">
                {display.split("").map((ch, j) => {
                  if (ch === " ") return <div key={j} className="w-2" />;
                  li++;
                  return (
                    <Tile key={j} ch={g[li]} mark={marks[li]} small={answer.length > 9} />
                  );
                })}
              </div>
            );
          })}
          {/* current row — word-boundary gaps mirror the display form */}
          {(() => {
            let li = -1;
            return (
              <div className={`flex items-center gap-1 ${shake ? "animate-shake" : ""}`}>
                {display.split("").map((ch, j) => {
                  if (ch === " ") return <div key={j} className="w-2" />;
                  li++;
                  const idx = li;
                  return (
                    <Tile
                      key={j}
                      ch={
                        showHint && idx === 0 && !current
                          ? answer[0]
                          : (current[idx] ?? "")
                      }
                      small={answer.length > 9}
                    />
                  );
                })}
              </div>
            );
          })()}
          {showHint && (
            <div className="text-xs text-amber-300">
              💡 {answer[0]}…
            </div>
          )}
        </div>

        <Keyboard onKey={handleKey} marks={kb} />
      </div>
    </div>
  );
}
