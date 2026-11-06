"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { GridPlayer } from "@/data/players";
import { dict, pick, type TKey } from "@/lib/strings";
import type { Grid } from "@/lib/tiki";
import { useArabicNames } from "@/lib/useArabicNames";
import { SaudiGridBoard } from "./SaudiGridBoard";

/** The board of a two-sided match on the site: a friend room (server) and the computer (browser) both draw it. */

export type Mark = "X" | "O";

export interface MatchRoom {
  board: ({ mark: Mark; name: string } | null)[];
  turn: Mark;
  winner: Mark | "draw" | null;
  flash: { mark: Mark; reason: string } | null;
  used: string[];
  endReason: "forfeit" | "agreed" | null;
  series: { X: number; O: number; target: number; over: boolean };
}

const SEARCH_LIMIT = 6;
const MIN_QUERY = 2;
const TICK_MS = 250;

const MARK_STYLE: Record<Mark, string> = { X: "bg-blue-100 text-blue-800", O: "bg-orange-100 text-orange-800" };

const other = (m: Mark): Mark => (m === "X" ? "O" : "X");
const lastWord = (name: string) => name.trim().split(/\s+/).slice(-1)[0];

export function GridMatch({ room, grid, myMark, seated = true, deadline, locale, opponentName, peerLeft = false, offline = false, peerAwayUntil = null, onMove, onSkip, onForfeit, onClose, children }: {
  room: MatchRoom;
  grid: Grid;
  myMark: Mark;
  seated?: boolean;
  deadline: number;
  locale: "ar" | "en";
  opponentName: string;
  peerLeft?: boolean;
  offline?: boolean;
  peerAwayUntil?: number | null;
  onMove: (cell: number, name: string) => void;
  onSkip: () => void;
  onForfeit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = (k: TKey) => dict[locale][k];
  const { search, shown } = useArabicNames(locale);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const suggestions = useMemo(() => search(query, SEARCH_LIMIT), [search, query]);
  const seriesOver = room.series.over;
  const playing = !room.winner;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  const myTurn = seated && room.turn === myMark && !room.winner && !peerLeft;
  const open = myTurn ? selected : null;
  const timeLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  const who = (m: Mark) => (m === myMark ? t("you") : opponentName);

  const choose = (p: GridPlayer) => {
    if (open === null) return;
    if (room.used.includes(p.name)) return setNotice(`${shown(p.name)}: ${t("bbAlready")}`);
    onMove(open, p.name);
    setNotice(null);
    setQuery("");
    setSelected(null);
  };

  const f = room.flash;
  const flashKey: TKey | null = f?.reason === "wrong" ? "ttWrong" : f?.reason === "timeout" ? "ttTimeout" : f?.reason === "skip" ? "htSkipped" : null;
  const iWon = room.winner === myMark;
  const result = room.endReason === "forfeit"
    ? t(iWon ? "htTheyForfeited" : "htYouForfeited")
    : seriesOver
      ? t(iWon ? "htSeriesWon" : "htSeriesLost")
      : room.winner === "draw"
        ? t("htGameDraw")
        : room.winner
          ? `${who(room.winner)} ${t("htTookGame")}`
          : null;

  const square = (i: number) => {
    const cell = room.board[i];
    if (cell) {
      return (
        <div className={`flex aspect-square flex-col items-center justify-center rounded-2xl p-1 text-center ${MARK_STYLE[cell.mark]}`}>
          <span className="text-3xl font-black leading-none">{cell.mark}</span>
          <span className="mt-1 w-full truncate text-[11px] font-bold">{lastWord(shown(cell.name))}</span>
        </div>
      );
    }
    return (
      <button
        type="button"
        disabled={!myTurn}
        onClick={() => { setSelected(i); setQuery(""); setNotice(null); }}
        aria-label={`${pick(grid.rows[Math.floor(i / 3)], locale)} × ${pick(grid.cols[i % 3], locale)}`}
        className={`flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-dashed bg-white text-xl ${open === i ? "border-[#15803d] text-[#15803d]" : "border-[#d5dbd6] text-[#c3c9d3]"}`}
      >
        +
      </button>
    );
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
        <span className={`rounded-xl px-3 py-1 text-sm font-black ${MARK_STYLE[myMark]}`}>{t("you")} {room.series[myMark]}</span>
        <span dir="ltr" className="text-2xl font-black tabular-nums">{room.winner ? "–" : timeLeft}</span>
        <span className={`rounded-xl px-3 py-1 text-sm font-black ${MARK_STYLE[other(myMark)]}`}>{opponentName} {room.series[other(myMark)]}</span>
      </div>

      <div aria-live="polite" className="flex min-h-10 flex-col items-center justify-center text-center text-sm font-bold">
        {offline && <span className="text-red-700">{t("connLost")}</span>}
        {peerAwayUntil && !peerLeft && <span className="text-[#56645c]">{t("connPeerAway").replace("{s}", String(Math.max(0, Math.ceil((peerAwayUntil - now) / 1000))))}</span>}
        {peerLeft && <span className="text-red-700">{t("htPeerLeft")}</span>}
        {result && <span>{result}</span>}
        {!peerLeft && !result && <span className={myTurn ? "text-[#15803d]" : "text-[#56645c]"}>{t(myTurn ? "htYourTurn" : "htTheirTurn")}</span>}
        {!result && f && flashKey && <span className="text-[#56645c]">{who(f.mark)}: {t(flashKey)}</span>}
        {notice && <span className="text-red-700">{notice}</span>}
      </div>

      {open !== null && (
        <div className="relative z-10 mb-2">
          <p className="mb-1 text-center text-xs font-bold text-[#56645c]">{pick(grid.rows[Math.floor(open / 3)], locale)} × {pick(grid.cols[open % 3], locale)}</p>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && suggestions[0]) choose(suggestions[0]); }}
            placeholder={t("bbSearch")}
            aria-label={t("bbSearch")}
            autoComplete="off"
            autoCorrect="off"
            className="min-h-12 w-full rounded-2xl border border-[#15803d] bg-white px-3 text-base outline-none"
          />
          {query.trim().length >= MIN_QUERY && (
            <ul className="absolute inset-x-0 top-full mt-1 max-h-64 overflow-auto rounded-2xl border border-[#e2e7e3] bg-white shadow-lg">
              {suggestions.length === 0 && <li className="p-3 text-center text-[#56645c]">{t("ttNoResult")}</li>}
              {suggestions.map((p) => (
                <li key={p.name}>
                  <button type="button" onClick={() => choose(p)} className="min-h-11 w-full border-b border-[#f1f4f1] px-3 py-2 text-start font-bold">{shown(p.name)}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <SaudiGridBoard grid={grid} locale={locale} square={square} />

      {!room.winner && !peerLeft && (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={!myTurn} onClick={onSkip} className="min-h-12 flex-1 rounded-2xl bg-white font-bold text-[#14532d] shadow-sm disabled:opacity-40">{t("htSkip")}</button>
          <button type="button" onClick={() => { if (window.confirm(t("htForfeit"))) onForfeit(); }} className="min-h-12 flex-1 rounded-2xl bg-white font-bold text-red-700 shadow-sm">{t("htForfeit")}</button>
        </div>
      )}

      {(seriesOver || peerLeft) && (
        <section className="mt-4 rounded-2xl bg-white p-5 text-center shadow-sm">
          <div className="text-4xl font-black tabular-nums" dir="ltr">{room.series[myMark]} – {room.series[other(myMark)]}</div>
          {children}
          <button type="button" onClick={onClose} className="mt-2 min-h-11 text-sm font-bold text-[#56645c]">{t("gulfBackToGrid")}</button>
        </section>
      )}
    </div>
  );
}
