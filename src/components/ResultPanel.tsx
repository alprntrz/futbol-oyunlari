"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Match, SlotState } from "@/lib/types";

export function ResultPanel({
  match,
  slots,
  won,
  day,
  onPlayAgain,
}: {
  match: Match;
  slots: SlotState[];
  won: boolean;
  day?: number;
  onPlayAgain?: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const totalGuesses = slots.reduce((a, s) => a + s.guesses.length, 0);

  const share = async () => {
    const rows = slots
      .map((s) =>
        s.solved
          ? s.guesses.length <= 2
            ? "🟩"
            : s.guesses.length <= 4
              ? "🟨"
              : "🟧"
          : "🟥"
      )
      .join("");
    const title = day !== undefined ? `Eksik 11 #${day}` : `Eksik 11 · ${match.team}`;
    const text = `${title}\n${rows}\n${totalGuesses} tahmin`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-center">
      <div className={`text-lg font-black ${won ? "text-emerald-400" : "text-red-400"}`}>
        {won ? t("won") : t("lost")}
      </div>
      <div className="mt-1 text-sm text-zinc-400">
        {t("totalGuesses")}: <b className="text-white">{totalGuesses}</b>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        <button
          onClick={share}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
        >
          {copied ? t("copied") : t("share")}
        </button>
        {onPlayAgain && (
          <button
            onClick={onPlayAgain}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500"
          >
            {t("newMatch")}
          </button>
        )}
      </div>
    </div>
  );
}
