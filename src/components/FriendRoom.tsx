"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { GridPlayer } from "@/data/players";
import { dealRoomGrid, gridFromIds, type GridIds } from "@/lib/saudiGrid";
import { dict, pick, type TKey } from "@/lib/strings";
import { useArabicNames } from "@/lib/useArabicNames";
import { gameSocket } from "@/lib/webSocket";
import { SaudiGridBoard } from "./SaudiGridBoard";

/** A friend room on the app's `ht:*` server events: the server owns the turn, the clock and the result. */

type Mark = "X" | "O";

interface Room {
  code: string;
  grid: GridIds;
  started: boolean;
  board: ({ mark: Mark; name: string } | null)[];
  turn: Mark;
  winner: Mark | "draw" | null;
  flash: { mark: Mark; reason: string } | null;
  remainingMs: number;
  turnMs?: number;
  used: string[];
  endReason: "forfeit" | "agreed" | null;
  series: { X: number; O: number; target: number; over: boolean };
  rematch?: { from: Mark | null; declined: boolean; open: boolean };
  players: { id: string; mark: Mark }[];
}

type RoomAnswer = { ok: boolean; error?: string; room?: Room };

const ACK_MS = 8000;
const NEXT_GAME_MS = 2000;
const SEARCH_LIMIT = 6;
const MIN_QUERY = 2;
const TICK_MS = 250;
const COPIED_MS = 1500;

const MARK_STYLE: Record<Mark, string> = { X: "bg-blue-100 text-blue-800", O: "bg-orange-100 text-orange-800" };

const other = (m: Mark): Mark => (m === "X" ? "O" : "X");
const lastWord = (name: string) => name.trim().split(/\s+/).slice(-1)[0];

export function FriendRoom({ joinCode, locale, onClose, onEvent }: {
  joinCode: string | null;
  locale: "ar" | "en";
  onClose: () => void;
  onEvent: (event: "friend_create" | "friend_join" | "friend_series_end") => void;
}) {
  const t = (k: TKey) => dict[locale][k];
  const { search, shown } = useArabicNames(locale);
  const [room, setRoom] = useState<Room | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<TKey | null>(null);
  const [peerLeft, setPeerLeft] = useState(false);
  const [myId, setMyId] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [peerAwayUntil, setPeerAwayUntil] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const code = useRef<string | null>(joinCode);

  useEffect(() => {
    const socket = gameSocket();
    const apply = (r: Room) => {
      setRoom(r);
      setDeadline(Date.now() + r.remainingMs);
    };
    const onUpdate = (r: Room) => {
      if (r.code !== code.current) return;
      setPeerLeft(false);
      apply(r);
    };
    const onPeerLeft = (r: Room) => {
      if (r.code !== code.current) return;
      setPeerLeft(true);
      apply(r);
    };
    const onConnect = () => {
      setMyId(socket.id ?? "");
      setOffline(false);
    };
    const onDisconnect = () => setOffline(true);
    const onPeerAway = (e: { game: string; away: boolean; ms?: number }) => {
      if (e.game === "ht") setPeerAwayUntil(e.away ? Date.now() + (e.ms ?? 0) : null);
    };
    // a new connection took over the seat: ask for the room as it stands
    const onSeatBack = () => socket.emit("ht:join", { code: code.current }, (res: RoomAnswer) => { if (res.room) apply(res.room); });
    const answered = (event: "friend_create" | "friend_join") => (err: Error | null, res?: RoomAnswer) => {
      if (err || !res) return setError("gulfNoServer");
      if (!res.ok || !res.room) return setError(res.error === "full" ? "roomFull" : "roomNotFound");
      code.current = res.room.code;
      setMyId(socket.id ?? "");
      apply(res.room);
      onEvent(event);
    };
    socket.on("ht:update", onUpdate);
    socket.on("ht:peer-left", onPeerLeft);
    socket.on("seat:back", onSeatBack);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("peer:away", onPeerAway);
    if (joinCode) socket.timeout(ACK_MS).emit("ht:join", { code: joinCode, nick: "" }, answered("friend_join"));
    else socket.timeout(ACK_MS).emit("ht:create", { nick: "", grid: dealRoomGrid(), steals: false, league: "sa" }, answered("friend_create"));
    return () => {
      socket.off("ht:update", onUpdate);
      socket.off("ht:peer-left", onPeerLeft);
      socket.off("seat:back", onSeatBack);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("peer:away", onPeerAway);
      socket.emit("ht:leave", { code: code.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = room?.players.find((p) => p.id === myId);
  const isHost = !!room && room.players[0]?.id === myId;
  const playing = !!room?.started && !room.winner;
  const seriesOver = !!room?.series.over;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  // no lobby step on the site: the game starts as soon as the friend is in
  useEffect(() => {
    if (room && !room.started && !room.winner && room.players.length === 2 && isHost) gameSocket().emit("ht:start");
  }, [room, isHost]);

  // between games of a series the host deals the next grid
  const hasWinner = !!room?.winner;
  useEffect(() => {
    if (!hasWinner || seriesOver || !isHost || peerLeft) return;
    const id = setTimeout(() => gameSocket().emit("ht:rematch", { grid: dealRoomGrid() }), NEXT_GAME_MS);
    return () => clearTimeout(id);
  }, [hasWinner, seriesOver, isHost, peerLeft]);

  useEffect(() => {
    if (seriesOver) onEvent("friend_series_end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesOver]);

  const grid = useMemo(() => (room ? gridFromIds(room.grid) : null), [room?.grid]); // eslint-disable-line react-hooks/exhaustive-deps
  const suggestions = useMemo(() => search(query, SEARCH_LIMIT), [search, query]);

  if (error) {
    return (
      <section className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="font-bold">{t(error)}</p>
        <button type="button" onClick={onClose} className="mt-4 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{t("gulfBackToGrid")}</button>
      </section>
    );
  }

  if (!room) return <p className="mt-10 text-center text-[#56645c]">{t("waiting")}</p>;

  if (!room.started || !grid) {
    const link = `${location.origin}/?room=${room.code}${locale === "en" ? "&lang=en" : ""}`;
    const send = async () => {
      try {
        if (navigator.share) await navigator.share({ text: t("gulfInvite"), url: link });
        else {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), COPIED_MS);
        }
      } catch (e) {
        console.warn("share closed", e); // cancelling the share sheet lands here too
      }
    };
    return (
      <section className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm">
        {peerLeft && <p className="mb-2 font-bold text-red-700">{t("htPeerLeft")}</p>}
        <p className="text-[#56645c]">{t("gulfInvite")}</p>
        <p dir="ltr" className="mt-2 break-all text-sm font-bold">{link}</p>
        <button type="button" onClick={send} className="mt-4 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{copied ? t("gulfLinkCopied") : t("gulfSendLink")}</button>
        <p className="mt-3 text-sm text-[#56645c]">{t("waiting")}</p>
        <button type="button" onClick={onClose} className="mt-2 min-h-11 text-sm font-bold text-[#56645c]">{t("gulfBackToGrid")}</button>
      </section>
    );
  }

  const myMark = me?.mark ?? "X";
  const myTurn = !!me && room.turn === me.mark && !room.winner && !peerLeft;
  const open = myTurn ? selected : null;
  const timeLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  const who = (m: Mark) => (m === myMark ? t("you") : t("opponent"));

  const choose = (p: GridPlayer) => {
    if (room.used.includes(p.name)) return setNotice(`${shown(p.name)}: ${t("bbAlready")}`);
    gameSocket().emit("ht:move", { cell: open, name: p.name });
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

  const rm = room.rematch;
  const incoming = !!rm?.from && rm.from !== myMark && !peerLeft;
  const outgoing = !!rm?.from && rm.from === myMark && !peerLeft;
  const canAsk = !peerLeft && !rm?.from && !rm?.declined && (isHost || !!rm?.open);
  const ask = () => gameSocket().emit(rm ? "ht:rematch-ask" : "ht:rematch", { grid: dealRoomGrid() });
  const reply = (accept: boolean) => gameSocket().emit("ht:rematch-reply", accept ? { accept, grid: dealRoomGrid() } : { accept });

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
        <span className={`rounded-xl px-3 py-1 text-sm font-black ${MARK_STYLE[other(myMark)]}`}>{t("opponent")} {room.series[other(myMark)]}</span>
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
          <button type="button" disabled={!myTurn} onClick={() => gameSocket().emit("ht:skip")} className="min-h-12 flex-1 rounded-2xl bg-white font-bold text-[#14532d] shadow-sm disabled:opacity-40">{t("htSkip")}</button>
          <button type="button" onClick={() => { if (window.confirm(t("htForfeit"))) gameSocket().emit("ht:forfeit"); }} className="min-h-12 flex-1 rounded-2xl bg-white font-bold text-red-700 shadow-sm">{t("htForfeit")}</button>
        </div>
      )}

      {(seriesOver || peerLeft) && (
        <section className="mt-4 rounded-2xl bg-white p-5 text-center shadow-sm">
          <div className="text-4xl font-black tabular-nums" dir="ltr">{room.series[myMark]} – {room.series[other(myMark)]}</div>
          {incoming && (
            <>
              <p className="mt-2 text-sm">{t("htRematchAsked").replace("{name}", t("opponent"))}</p>
              <button type="button" onClick={() => reply(true)} className="mt-3 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{t("htAccept")}</button>
              <button type="button" onClick={() => reply(false)} className="mt-2 min-h-12 w-full rounded-2xl bg-[#ddf5e4] font-black text-[#14532d]">{t("htDecline")}</button>
            </>
          )}
          {!incoming && canAsk && <button type="button" onClick={ask} className="mt-3 min-h-12 w-full rounded-2xl bg-[#15803d] font-black text-white">{t("htRematch")}</button>}
          {!incoming && !canAsk && !peerLeft && <p className="mt-2 text-sm text-[#56645c]">{t(outgoing ? "htRematchWaiting" : rm?.declined ? "htRematchDeclined" : "htWaitRematch")}</p>}
          <button type="button" onClick={onClose} className="mt-2 min-h-11 text-sm font-bold text-[#56645c]">{t("gulfBackToGrid")}</button>
        </section>
      )}
    </div>
  );
}
