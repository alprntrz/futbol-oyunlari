"use client";

import { useI18n } from "@/lib/i18n";
import type { TileMark } from "@/lib/types";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

export function Keyboard({
  onKey,
  marks,
}: {
  onKey: (key: string) => void; // letter, "ENTER" or "DELETE"
  marks: Record<string, TileMark>;
}) {
  const { t } = useI18n();

  const markClass = (ch: string) => {
    switch (marks[ch]) {
      case "correct":
        return "bg-emerald-500 text-white";
      case "present":
        return "bg-amber-400 text-black";
      case "absent":
        return "bg-zinc-700 text-zinc-400";
      default:
        return "bg-zinc-500/80 text-white";
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      {ROWS.map((row, ri) => (
        <div key={row} className="flex w-full justify-center gap-1">
          {ri === 2 && (
            <button
              onClick={() => onKey("ENTER")}
              className="flex h-11 min-w-[52px] items-center justify-center rounded bg-indigo-500 px-2 text-[11px] font-bold text-white active:scale-95"
            >
              {t("keyboardEnter")}
            </button>
          )}
          {row.split("").map((ch) => (
            <button
              key={ch}
              onClick={() => onKey(ch)}
              className={`flex h-11 flex-1 basis-0 items-center justify-center rounded text-sm font-bold uppercase active:scale-95 max-w-10 ${markClass(ch)}`}
            >
              {ch}
            </button>
          ))}
          {ri === 2 && (
            <button
              onClick={() => onKey("DELETE")}
              className="flex h-11 min-w-[52px] items-center justify-center rounded bg-zinc-600 px-2 text-[11px] font-bold text-white active:scale-95"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
