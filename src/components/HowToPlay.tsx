"use client";

import { useI18n } from "@/lib/i18n";

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();

  const Row = ({ word, marks, note }: { word: string; marks: ("c" | "p" | "a" | "n")[]; note: string }) => (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-1">
        {word.split("").map((ch, i) => (
          <div
            key={i}
            className={`flex h-9 w-9 items-center justify-center rounded border-2 text-lg font-black ${
              marks[i] === "c"
                ? "border-emerald-500 bg-emerald-500 text-white"
                : marks[i] === "p"
                  ? "border-amber-400 bg-amber-400 text-black"
                  : marks[i] === "a"
                    ? "border-zinc-600 bg-zinc-700 text-zinc-300"
                    : "border-zinc-600 text-white"
            }`}
          >
            {ch}
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-400">{note}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-black text-white">{t("howToPlay")}</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-800">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-zinc-300">{t("howToPlayText")}</p>
        <div className="flex flex-col gap-3">
          <Row word="MESSI" marks={["c", "n", "n", "n", "n"]} note={t("hintCorrect")} />
          <Row word="NEUER" marks={["n", "n", "p", "n", "n"]} note={t("hintPresent")} />
          <Row word="ONYEL" marks={["n", "n", "a", "n", "n"]} note={t("hintAbsent")} />
        </div>
      </div>
    </div>
  );
}
